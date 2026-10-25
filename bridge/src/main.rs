mod discord;
mod install;
mod native;

use discord::{Discord, SetError};
use serde_json::{Value, json};
use std::io::{self, Write};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::thread;
use std::time::Duration;

// how often to look for Discord again while it's closed
const RETRY: Duration = Duration::from_secs(10);

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let first = args.first().map(String::as_str);

    match first {
        // the browser starts us with the extension origin as the first argument
        Some(a) if a.starts_with("chrome-extension://") => host(),
        Some("install") => exit_with(install::install(args.get(1).map(String::as_str))),
        Some("uninstall") => exit_with(install::uninstall()),
        Some("--version") => println!("xpresence-bridge {}", env!("CARGO_PKG_VERSION")),
        Some(other) => {
            eprintln!("unknown command: {other}");
            eprintln!("usage: xpresence-bridge [install [extension-id] | uninstall | --version]");
            std::process::exit(2);
        }
        // double clicked from the file explorer
        None => {
            let res = install::install(None);
            if let Err(e) = &res {
                eprintln!("Install failed: {e}");
            } else {
                println!("\nAll set. Reload the Xpresence extension in your browser.");
            }
            print!("\nPress Enter to close...");
            let _ = io::stdout().flush();
            let _ = io::stdin().read_line(&mut String::new());
        }
    }
}

fn exit_with(res: io::Result<()>) {
    if let Err(e) = res {
        eprintln!("{e}");
        std::process::exit(1);
    }
}

struct Bridge {
    client_id: Option<String>,
    discord: Option<Discord>,
    wanted: Option<Value>,
    error: Option<String>,
}

impl Bridge {
    fn apply(&mut self) {
        let Some(id) = self.client_id.clone() else { return };

        // nothing to show and not connected, nothing to clear either
        if self.discord.is_none() && self.wanted.is_none() {
            return;
        }

        // one retry covers Discord being restarted since the last update
        for _ in 0..2 {
            if self.discord.is_none() {
                match Discord::connect(&id) {
                    Ok(d) => self.discord = Some(d),
                    Err(e) => {
                        self.error = Some(e.to_string());
                        return;
                    }
                }
            }
            let d = self.discord.as_mut().unwrap();
            match d.set_activity(self.wanted.as_ref()) {
                Ok(()) => {
                    self.error = None;
                    return;
                }
                Err(SetError::Rejected(r)) => {
                    self.error = Some(format!("Discord rejected the update: {}", r.0));
                    return;
                }
                Err(SetError::Io(e)) => {
                    self.error = Some(e.to_string());
                    self.discord = None;
                }
            }
        }
    }

    fn status(&self) -> Value {
        json!({
            "type": "status",
            "version": env!("CARGO_PKG_VERSION"),
            "discord": if self.discord.is_some() { "connected" } else { "offline" },
            "user": self.discord.as_ref().and_then(|d| d.user.clone()),
            "showing": self.discord.is_some() && self.wanted.is_some() && self.error.is_none(),
            "error": self.error,
        })
    }
}

fn host() {
    let (tx, rx) = mpsc::channel::<Option<Value>>();

    // stdin closes when the browser drops the port, which ends everything
    thread::spawn(move || {
        let mut input = io::stdin().lock();
        loop {
            match native::read(&mut input) {
                Ok(Some(msg)) => {
                    if tx.send(Some(msg)).is_err() {
                        break;
                    }
                }
                _ => {
                    let _ = tx.send(None);
                    break;
                }
            }
        }
    });

    let mut out = io::stdout().lock();
    let mut b = Bridge { client_id: None, discord: None, wanted: None, error: None };
    let mut last_sent = Value::Null;

    loop {
        let mut dirty = false;
        let mut force = false;

        match rx.recv_timeout(RETRY) {
            Ok(Some(msg)) => match msg["type"].as_str() {
                Some("hello") => {
                    let id = msg["clientId"].as_str().map(str::to_string);
                    if id != b.client_id {
                        b.discord = None;
                        b.client_id = id;
                    }
                    dirty = true;
                    force = true;
                }
                Some("set") => {
                    b.wanted = Some(msg["activity"].clone());
                    dirty = true;
                }
                Some("clear") => {
                    b.wanted = None;
                    dirty = true;
                }
                Some("ping") => force = true,
                _ => {}
            },
            Ok(None) | Err(RecvTimeoutError::Disconnected) => break,
            Err(RecvTimeoutError::Timeout) => {
                dirty = b.discord.is_none() && b.wanted.is_some();
            }
        }

        if dirty {
            b.apply();
        }

        let status = b.status();
        if force || dirty || status != last_sent {
            if native::write(&mut out, &status).is_err() {
                break;
            }
            last_sent = status;
        }
    }

    // Discord also clears it once our pid is gone, this just makes it instant
    if let Some(d) = b.discord.as_mut() {
        let _ = d.set_activity(None);
    }
}
