use serde::Serialize;
use wasm_bindgen::prelude::*;
use worker::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = crypto, js_name = getRandomValues)]
    fn get_random_values(buf: &mut [u8]);
}

pub fn random_id(len: usize) -> String {
    const ALPHABET: &[u8] = b"abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut buf = vec![0u8; len];
    get_random_values(&mut buf);
    buf.iter()
        .map(|b| ALPHABET[*b as usize % ALPHABET.len()] as char)
        .collect()
}

pub fn now_ms() -> i64 {
    Date::now().as_millis() as i64
}

pub fn today_utc() -> String {
    let d = js_sys::Date::new_0();
    format!(
        "{:04}-{:02}-{:02}",
        d.get_utc_full_year(),
        d.get_utc_month() + 1,
        d.get_utc_date()
    )
}

pub fn json_response<T: Serialize>(value: &T, status: u16) -> Result<Response> {
    Ok(Response::from_json(value)?.with_status(status))
}

pub async fn internal_post<T: Serialize>(stub: &Stub, path: &str, body: &T) -> Result<Response> {
    let headers = Headers::new();
    headers.set("Content-Type", "application/json")?;
    let mut init = RequestInit::new();
    init.with_method(Method::Post)
        .with_headers(headers)
        .with_body(Some(serde_json::to_string(body)?.into()));
    let req = Request::new_with_init(&format!("https://internal{path}"), &init)?;
    let resp = stub.fetch_with_request(req).await?;
    if resp.status_code() >= 400 {
        return Err(Error::RustError(format!(
            "internal call {path} failed: {}",
            resp.status_code()
        )));
    }
    Ok(resp)
}
