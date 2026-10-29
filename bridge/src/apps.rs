// What desktop apps are playing, read from their window titles.
// The Apple TV app doesn't tell Windows what's playing, but its player window is named after it.

// window titles that are the app itself, not something playing
#[cfg(windows)]
const APPLE_TV_IDLE: [&str; 3] = ["apple tv", "apple tv preview", "apple tv+"];

#[cfg(windows)]
pub fn apple_tv() -> Option<String> {
    win::app_windows("appletv")
        .into_iter()
        .map(|t| t.trim().to_string())
        .find(|t| !t.is_empty() && !APPLE_TV_IDLE.contains(&t.to_lowercase().as_str()))
}

#[cfg(not(windows))]
pub fn apple_tv() -> Option<String> {
    None
}

#[cfg(windows)]
mod win {
    use windows_sys::Win32::Foundation::{CloseHandle, HWND, LPARAM};
    use windows_sys::Win32::System::Threading::{
        OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION, QueryFullProcessImageNameW,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumChildWindows, EnumWindows, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
        IsWindowVisible,
    };
    use windows_sys::core::BOOL;

    unsafe extern "system" fn collect(hwnd: HWND, list: LPARAM) -> BOOL {
        // SAFETY: list is the Vec passed in by windows() below, alive for the whole call
        let list = unsafe { &mut *(list as *mut Vec<HWND>) };
        list.push(hwnd);
        1
    }

    fn top_windows() -> Vec<HWND> {
        let mut list: Vec<HWND> = Vec::new();
        // SAFETY: the callback only pushes into list, which outlives the call
        unsafe { EnumWindows(Some(collect), &mut list as *mut Vec<HWND> as LPARAM) };
        list
    }

    fn child_windows(parent: HWND) -> Vec<HWND> {
        let mut list: Vec<HWND> = Vec::new();
        // SAFETY: same as above
        unsafe { EnumChildWindows(parent, Some(collect), &mut list as *mut Vec<HWND> as LPARAM) };
        list
    }

    fn pid(hwnd: HWND) -> u32 {
        let mut pid = 0u32;
        // SAFETY: pid is a valid out pointer
        unsafe { GetWindowThreadProcessId(hwnd, &mut pid) };
        pid
    }

    fn exe_path(pid: u32) -> Option<String> {
        // SAFETY: plain win32 calls, the handle is closed before returning
        unsafe {
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if handle.is_null() {
                return None;
            }
            let mut buf = [0u16; 1024];
            let mut len = buf.len() as u32;
            let ok = QueryFullProcessImageNameW(handle, 0, buf.as_mut_ptr(), &mut len);
            CloseHandle(handle);
            (ok != 0).then(|| String::from_utf16_lossy(&buf[..len as usize]).to_lowercase())
        }
    }

    fn title(hwnd: HWND) -> String {
        // SAFETY: the buffer is sized from GetWindowTextLengthW plus the terminator
        unsafe {
            let len = GetWindowTextLengthW(hwnd);
            if len <= 0 {
                return String::new();
            }
            let mut buf = vec![0u16; len as usize + 1];
            let got = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
            String::from_utf16_lossy(&buf[..got.max(0) as usize])
        }
    }

    // titles of visible windows whose program path contains `name`
    pub fn app_windows(name: &str) -> Vec<String> {
        let mut titles = Vec::new();
        for hwnd in top_windows() {
            // SAFETY: hwnd came from EnumWindows
            if unsafe { IsWindowVisible(hwnd) } == 0 {
                continue;
            }
            let host = pid(hwnd);
            let Some(mut path) = exe_path(host) else { continue };

            // store apps can sit inside a frame window owned by another process
            if path.ends_with("applicationframehost.exe")
                && let Some(inner) = child_windows(hwnd).into_iter().map(pid).find(|p| *p != host)
            {
                path = exe_path(inner).unwrap_or(path);
            }

            if path.contains(name) {
                titles.push(title(hwnd));
            }
        }
        titles
    }
}
