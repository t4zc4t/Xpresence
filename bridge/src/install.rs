// Registers the bridge with Chromium browsers so the extension can reach it.

use serde_json::json;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

pub const HOST_NAME: &str = "com.xpresence.bridge";

// ID of the unpacked extension (fixed by the key in its manifest)
const EXTENSION_ID: &str = "nignpcfjcehphbjbbcfdopejioilbnih";

pub fn install(extra_id: Option<&str>) -> io::Result<()> {
    let dir = install_dir()?;
    fs::create_dir_all(&dir)?;

    let exe_name = if cfg!(windows) { "xpresence-bridge.exe" } else { "xpresence-bridge" };
    let target = dir.join(exe_name);
    let current = std::env::current_exe()?;
    if !same_file(&current, &target) {
        fs::copy(&current, &target).map_err(|e| {
            io::Error::new(e.kind(), format!("could not copy the bridge ({e}), close your browser and try again"))
        })?;
    }

    let mut origins = vec![format!("chrome-extension://{EXTENSION_ID}/")];
    if let Some(id) = extra_id.filter(|id| valid_id(id)) {
        origins.push(format!("chrome-extension://{id}/"));
    }
    let manifest = json!({
        "name": HOST_NAME,
        "description": "Xpresence bridge to Discord",
        "path": target,
        "type": "stdio",
        "allowed_origins": origins,
    });
    let manifest = serde_json::to_string_pretty(&manifest)?;

    let done = register(&dir, &manifest)?;
    println!("Xpresence bridge installed to {}", dir.display());
    for b in done {
        println!("  registered for {b}");
    }
    Ok(())
}

pub fn uninstall() -> io::Result<()> {
    unregister()?;
    remove_files()?;
    println!("Xpresence bridge removed");
    Ok(())
}

// called by the extension through the bridge itself, so the files may be in use
pub fn uninstall_quietly() -> io::Result<()> {
    unregister()?;
    remove_files()
}

#[cfg(windows)]
fn remove_files() -> io::Result<()> {
    use std::os::windows::process::CommandExt;
    use std::process::{Command, Stdio};
    const DETACHED: u32 = 0x0000_0008;
    const NO_WINDOW: u32 = 0x0800_0000;

    let dir = install_dir()?;
    // a running exe can't delete itself, so a hidden cmd does it a moment after we exit
    Command::new("cmd")
        .arg("/C")
        .raw_arg(format!("ping 127.0.0.1 -n 3 > nul & rmdir /s /q \"{}\"", dir.display()))
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .creation_flags(DETACHED | NO_WINDOW)
        .spawn()?;
    Ok(())
}

#[cfg(unix)]
fn remove_files() -> io::Result<()> {
    // unix lets a running program delete its own file
    let _ = fs::remove_dir_all(install_dir()?);
    Ok(())
}

fn valid_id(id: &str) -> bool {
    id.len() == 32 && id.bytes().all(|b| (b'a'..=b'p').contains(&b))
}

fn same_file(a: &Path, b: &Path) -> bool {
    match (a.canonicalize(), b.canonicalize()) {
        (Ok(a), Ok(b)) => a == b,
        _ => false,
    }
}

#[cfg(windows)]
fn install_dir() -> io::Result<PathBuf> {
    std::env::var_os("LOCALAPPDATA")
        .map(|p| PathBuf::from(p).join("Xpresence"))
        .ok_or_else(|| io::Error::other("LOCALAPPDATA is not set"))
}

#[cfg(windows)]
const REG_KEYS: [(&str, &str); 4] = [
    ("Brave", r"HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts"),
    ("Chrome", r"HKCU\Software\Google\Chrome\NativeMessagingHosts"),
    ("Edge", r"HKCU\Software\Microsoft\Edge\NativeMessagingHosts"),
    ("Chromium", r"HKCU\Software\Chromium\NativeMessagingHosts"),
];

#[cfg(windows)]
fn register(dir: &Path, manifest: &str) -> io::Result<Vec<&'static str>> {
    use std::process::Command;
    let file = dir.join(format!("{HOST_NAME}.json"));
    fs::write(&file, manifest)?;
    let mut done = Vec::new();
    for (browser, key) in REG_KEYS {
        let ok = Command::new("reg")
            .args(["add", &format!(r"{key}\{HOST_NAME}"), "/ve", "/t", "REG_SZ", "/d"])
            .arg(&file)
            .arg("/f")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
        if ok {
            done.push(browser);
        }
    }
    Ok(done)
}

#[cfg(windows)]
fn unregister() -> io::Result<()> {
    use std::process::Command;
    for (_, key) in REG_KEYS {
        let _ = Command::new("reg")
            .args(["delete", &format!(r"{key}\{HOST_NAME}"), "/f"])
            .output();
    }
    Ok(())
}

#[cfg(unix)]
fn home() -> io::Result<PathBuf> {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| io::Error::other("HOME is not set"))
}

#[cfg(unix)]
fn install_dir() -> io::Result<PathBuf> {
    let base = if cfg!(target_os = "macos") {
        home()?.join("Library/Application Support")
    } else {
        std::env::var_os("XDG_DATA_HOME")
            .filter(|v| !v.is_empty())
            .map(PathBuf::from)
            .unwrap_or(home()?.join(".local/share"))
    };
    Ok(base.join("xpresence"))
}

// browser profile folders, the hosts folder lives inside each one
#[cfg(unix)]
fn browser_dirs() -> io::Result<Vec<(&'static str, PathBuf)>> {
    let h = home()?;
    let list: Vec<(&str, PathBuf)> = if cfg!(target_os = "macos") {
        let s = h.join("Library/Application Support");
        vec![
            ("Brave", s.join("BraveSoftware/Brave-Browser")),
            ("Chrome", s.join("Google/Chrome")),
            ("Edge", s.join("Microsoft Edge")),
            ("Chromium", s.join("Chromium")),
            ("Vivaldi", s.join("Vivaldi")),
        ]
    } else {
        let c = std::env::var_os("XDG_CONFIG_HOME")
            .filter(|v| !v.is_empty())
            .map(PathBuf::from)
            .unwrap_or(h.join(".config"));
        vec![
            ("Brave", c.join("BraveSoftware/Brave-Browser")),
            ("Chrome", c.join("google-chrome")),
            ("Edge", c.join("microsoft-edge")),
            ("Chromium", c.join("chromium")),
            ("Vivaldi", c.join("vivaldi")),
        ]
    };
    Ok(list)
}

#[cfg(unix)]
fn register(_dir: &Path, manifest: &str) -> io::Result<Vec<&'static str>> {
    let mut done = Vec::new();
    for (browser, profile) in browser_dirs()? {
        if !profile.is_dir() {
            continue;
        }
        let hosts = profile.join("NativeMessagingHosts");
        fs::create_dir_all(&hosts)?;
        fs::write(hosts.join(format!("{HOST_NAME}.json")), manifest)?;
        done.push(browser);
    }
    Ok(done)
}

#[cfg(unix)]
fn unregister() -> io::Result<()> {
    for (_, profile) in browser_dirs()? {
        let _ = fs::remove_file(profile.join("NativeMessagingHosts").join(format!("{HOST_NAME}.json")));
    }
    Ok(())
}
