//! Client IP address of a request, for rate limiting and the sessions list.

use axum::http::HeaderMap;
use std::net::{IpAddr, SocketAddr};

/// Returns the client's IP address.
///
/// With `trusted_hops = N > 0`, the address is the N-th `X-Forwarded-For` entry counted from
/// the right: each trusted proxy appends the address it received the request from, so that
/// entry is set by our own proxy and cannot be forged by the client (entries further left
/// can). Without the header, with `trusted_hops = 0`, or when the chosen entry is not an IP
/// address, the TCP peer address is used.
pub fn client_ip(
    headers: &HeaderMap,
    peer: Option<SocketAddr>,
    trusted_hops: usize,
) -> Option<String> {
    let forwarded = (trusted_hops > 0)
        .then(|| headers.get("x-forwarded-for"))
        .flatten()
        .and_then(|v| v.to_str().ok())
        .and_then(|v| {
            let entries: Vec<&str> = v.split(',').map(str::trim).collect();
            // With fewer entries than configured hops, the leftmost one is the best guess
            let index = entries.len().saturating_sub(trusted_hops);
            parse_ip(entries[index])
        });

    forwarded
        .or_else(|| peer.map(|p| p.ip()))
        .map(|ip| ip.to_canonical().to_string())
}

/// Parses an `X-Forwarded-For` entry, which may carry a port (`1.2.3.4:5678`, `[::1]:80`).
fn parse_ip(entry: &str) -> Option<IpAddr> {
    entry
        .parse::<IpAddr>()
        .ok()
        .or_else(|| entry.parse::<SocketAddr>().ok().map(|s| s.ip()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn headers(xff: Option<&str>) -> HeaderMap {
        let mut h = HeaderMap::new();
        if let Some(v) = xff {
            h.insert("x-forwarded-for", v.parse().unwrap());
        }
        h
    }

    const PEER: Option<SocketAddr> = Some(SocketAddr::new(
        IpAddr::V4(std::net::Ipv4Addr::new(10, 0, 0, 1)),
        4000,
    ));

    #[test]
    fn uses_peer_without_header() {
        assert_eq!(
            client_ip(&headers(None), PEER, 1).as_deref(),
            Some("10.0.0.1")
        );
        assert_eq!(client_ip(&headers(None), None, 1), None);
    }

    #[test]
    fn ignores_header_with_zero_hops() {
        let h = headers(Some("203.0.113.7"));
        assert_eq!(client_ip(&h, PEER, 0).as_deref(), Some("10.0.0.1"));
    }

    #[test]
    fn takes_rightmost_entry_with_one_hop() {
        // The client forged the first entry; our proxy appended the real address
        let h = headers(Some("1.1.1.1, 203.0.113.7"));
        assert_eq!(client_ip(&h, PEER, 1).as_deref(), Some("203.0.113.7"));
    }

    #[test]
    fn counts_hops_from_the_right() {
        let h = headers(Some("1.1.1.1, 203.0.113.7, 10.1.1.1"));
        assert_eq!(client_ip(&h, PEER, 2).as_deref(), Some("203.0.113.7"));
        // More hops than entries falls back to the leftmost entry
        assert_eq!(client_ip(&h, PEER, 5).as_deref(), Some("1.1.1.1"));
    }

    #[test]
    fn accepts_ports_and_ipv6() {
        let h = headers(Some("203.0.113.7:5555"));
        assert_eq!(client_ip(&h, PEER, 1).as_deref(), Some("203.0.113.7"));
        let h = headers(Some("[2001:db8::1]:443"));
        assert_eq!(client_ip(&h, PEER, 1).as_deref(), Some("2001:db8::1"));
        let h = headers(Some("::ffff:203.0.113.7"));
        assert_eq!(client_ip(&h, PEER, 1).as_deref(), Some("203.0.113.7"));
    }

    #[test]
    fn falls_back_to_peer_on_junk() {
        let h = headers(Some("unknown"));
        assert_eq!(client_ip(&h, PEER, 1).as_deref(), Some("10.0.0.1"));
        let h = headers(Some(""));
        assert_eq!(client_ip(&h, PEER, 1).as_deref(), Some("10.0.0.1"));
    }
}
