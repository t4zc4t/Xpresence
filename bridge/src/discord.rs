// Minimal Discord RPC client over the local IPC pipe / socket.
// Frame: opcode (u32 LE), length (u32 LE), JSON body.

use serde_json::{Value, json};
use std::io::{self, Read, Write};

const HANDSHAKE: u32 = 0;
const FRAME: u32 = 1;
const CLOSE: u32 = 2;
const PING: u32 = 3;
const PONG: u32 = 4;

trait Pipe: Read + Write + Send {}
impl<T: Read + Write + Send> Pipe for T {}

pub struct Discord {
    pipe: Box<dyn Pipe>,
    nonce: u64,
    pub user: Option<String>,
}

// Discord rejected the payload, the connection itself is still fine
pub struct Rejected(pub String);

pub enum SetError {
    Io(io::Error),
    Rejected(Rejected),
}

impl From<io::Error> for SetError {
    fn from(e: io::Error) -> Self {
        SetError::Io(e)
    }
}

impl Discord {
    pub fn connect(client_id: &str) -> io::Result<Discord> {
        let pipe = open_pipe().ok_or_else(|| {
            io::Error::new(io::ErrorKind::NotFound, "Discord is not running")
        })?;
        let mut d = Discord { pipe, nonce: 0, user: None };
        d.send(HANDSHAKE, &json!({ "v": 1, "client_id": client_id }))?;
        let ready = d.recv()?;
        if ready["evt"] != "READY" {
            let msg = ready["message"].as_str().unwrap_or("handshake failed");
            return Err(io::Error::new(io::ErrorKind::ConnectionRefused, msg.to_string()));
        }
        let user = &ready["data"]["user"];
        d.user = user["global_name"]
            .as_str()
            .or(user["username"].as_str())
            .map(str::to_string);
        Ok(d)
    }

    // None clears the activity
    pub fn set_activity(&mut self, activity: Option<&Value>) -> Result<(), SetError> {
        self.nonce += 1;
        let nonce = self.nonce.to_string();
        self.send(
            FRAME,
            &json!({
                "cmd": "SET_ACTIVITY",
                "args": { "pid": std::process::id(), "activity": activity },
                "nonce": nonce,
            }),
        )?;
        loop {
            let reply = self.recv()?;
            if reply["nonce"] != nonce.as_str() {
                continue;
            }
            if reply["evt"] == "ERROR" {
                let msg = reply["data"]["message"].as_str().unwrap_or("unknown error");
                return Err(SetError::Rejected(Rejected(msg.to_string())));
            }
            return Ok(());
        }
    }

    fn send(&mut self, op: u32, body: &Value) -> io::Result<()> {
        let body = serde_json::to_vec(body)?;
        let mut frame = Vec::with_capacity(8 + body.len());
        frame.extend_from_slice(&op.to_le_bytes());
        frame.extend_from_slice(&(body.len() as u32).to_le_bytes());
        frame.extend_from_slice(&body);
        self.pipe.write_all(&frame)?;
        self.pipe.flush()
    }

    fn recv(&mut self) -> io::Result<Value> {
        loop {
            let mut head = [0u8; 8];
            self.pipe.read_exact(&mut head)?;
            let op = u32::from_le_bytes(head[0..4].try_into().unwrap());
            let len = u32::from_le_bytes(head[4..8].try_into().unwrap()) as usize;
            if len > 1024 * 1024 {
                return Err(io::Error::new(io::ErrorKind::InvalidData, "frame too big"));
            }
            let mut body = vec![0u8; len];
            self.pipe.read_exact(&mut body)?;
            let body: Value = serde_json::from_slice(&body).unwrap_or(Value::Null);
            match op {
                PING => self.send(PONG, &body)?,
                CLOSE => {
                    let msg = body["message"].as_str().unwrap_or("closed by Discord");
                    return Err(io::Error::new(io::ErrorKind::ConnectionAborted, msg.to_string()));
                }
                _ => return Ok(body),
            }
        }
    }
}

#[cfg(windows)]
fn open_pipe() -> Option<Box<dyn Pipe>> {
    use std::fs::OpenOptions;
    (0..10).find_map(|i| {
        OpenOptions::new()
            .read(true)
            .write(true)
            .open(format!(r"\\.\pipe\discord-ipc-{i}"))
            .ok()
            .map(|f| Box::new(f) as Box<dyn Pipe>)
    })
}

#[cfg(unix)]
fn open_pipe() -> Option<Box<dyn Pipe>> {
    use std::os::unix::net::UnixStream;
    use std::path::PathBuf;
    use std::time::Duration;

    let mut bases: Vec<PathBuf> = ["XDG_RUNTIME_DIR", "TMPDIR", "TMP", "TEMP"]
        .iter()
        .filter_map(|v| std::env::var_os(v).map(PathBuf::from))
        .collect();
    bases.push(PathBuf::from("/tmp"));

    // flatpak and snap builds keep the socket in a subfolder
    let subs = ["", "app/com.discordapp.Discord", "app/com.discordapp.DiscordCanary", "snap.discord"];

    for base in &bases {
        for sub in subs {
            for i in 0..10 {
                let path = base.join(sub).join(format!("discord-ipc-{i}"));
                if let Ok(s) = UnixStream::connect(&path) {
                    let _ = s.set_read_timeout(Some(Duration::from_secs(10)));
                    return Some(Box::new(s));
                }
            }
        }
    }
    None
}
