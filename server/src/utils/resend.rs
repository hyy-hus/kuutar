use crate::errors::AppError;
use serde::Serialize;

#[derive(Debug, Serialize)]
struct ResendEmailRequest<'a> {
    from: &'a str,
    to: Vec<&'a str>,
    subject: &'a str,
    html: &'a str,
}

pub async fn send_otp_email(
    api_key: &str,
    from_email: &str,
    to_email: &str,
    otp_code: &str,
) -> Result<(), AppError> {
    let client = reqwest::Client::new();

    let html_body = format!(
        r#"
        <div style="font-family: monospace; padding: 20px; background-color: #f5f5f4; border-radius: 8px;">
            <h2 style="color: #1c1917;">Kirjautumiskoodisi</h2>
            <p style="color: #44403c; font-size: 14px;">Käytä alla olevaa kertakäyttökoodia kirjautuaksesi varauskalenteriin:</p>
            <div style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #6b21a8; padding: 12px 0;">
                {otp_code}
            </div>
            <p style="color: #78716c; font-size: 12px;">Koodi on voimassa 10 minuuttia. Jos et pyytänyt tätä koodia, voit jättää tämän viestin huomiotta.</p>
        </div>
        "#
    );

    let payload = ResendEmailRequest {
        from: from_email,
        to: vec![to_email],
        subject: "Kirjautumiskoodisi - Varauskalenteri",
        html: &html_body,
    };

    let res = client
        .post("https://api.resend.com/emails")
        .bearer_auth(api_key)
        .json(&payload)
        .send()
        .await
        .map_err(|e| AppError::InternalServerError(format!("Sähköpostipalvelun virhe: {e}")))?;

    let is_success = res.status().is_success(); // Store as bool directly

    if !is_success {
        let err_text = res.text().await.unwrap_or_default();
        tracing::error!("Resend API error: {err_text}");
        return Err(AppError::InternalServerError(
            "Sähköpostikoodin lähetys epäonnistui.".to_string(),
        ));
    }

    Ok(())
}
