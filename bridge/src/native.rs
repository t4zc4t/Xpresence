// Browser native messaging: each message is a 4 byte length (native endian) then JSON.

use serde_json::Value;
use std::io::{self, Read, Write};

// Chrome caps messages to the host at 4 GB, we never need more than this.
const MAX_IN: usize = 64 * 1024;

pub fn read(input: &mut impl Read) -> io::Result<Option<Value>> {
    let mut len = [0u8; 4];
    match input.read_exact(&mut len) {
        Ok(()) => {}
        Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(e) => return Err(e),
    }
    let len = u32::from_ne_bytes(len) as usize;
    if len > MAX_IN {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "message too big"));
    }
    let mut buf = vec![0u8; len];
    input.read_exact(&mut buf)?;
    serde_json::from_slice(&buf)
        .map(Some)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
}

pub fn write(out: &mut impl Write, msg: &Value) -> io::Result<()> {
    let body = serde_json::to_vec(msg)?;
    out.write_all(&(body.len() as u32).to_ne_bytes())?;
    out.write_all(&body)?;
    out.flush()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn round_trip() {
        let mut buf = Vec::new();
        write(&mut buf, &json!({"type": "ping"})).unwrap();
        let back = read(&mut buf.as_slice()).unwrap().unwrap();
        assert_eq!(back["type"], "ping");
    }

    #[test]
    fn eof_is_none() {
        assert!(read(&mut [].as_slice()).unwrap().is_none());
    }
}
