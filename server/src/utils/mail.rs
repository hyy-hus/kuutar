use crate::config::{Config, SmtpTls};
use crate::errors::AppError;
use lettre::{
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
    message::{Mailbox, header::ContentType},
    transport::smtp::authentication::Credentials,
};

fn otp_html(otp_code: &str) -> String {
    format!(
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
    )
}

fn build_transport(config: &Config) -> Result<AsyncSmtpTransport<Tokio1Executor>, AppError> {
    let host = config
        .smtp_host
        .as_deref()
        .ok_or_else(|| AppError::InternalServerError("SMTP_HOST puuttuu.".to_string()))?;

    let builder = match config.smtp_tls {
        SmtpTls::Starttls => AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(host),
        SmtpTls::Tls => AsyncSmtpTransport::<Tokio1Executor>::relay(host),
        SmtpTls::None => Ok(AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(
            host,
        )),
    }
    .map_err(|e| {
        tracing::error!("SMTP transport error: {e}");
        AppError::InternalServerError("Sähköpostipalvelun asetukset ovat virheelliset.".to_string())
    })?
    .port(config.smtp_port);

    let builder = match (&config.smtp_username, &config.smtp_password) {
        (Some(user), Some(pass)) => {
            builder.credentials(Credentials::new(user.clone(), pass.clone()))
        }
        _ => builder,
    };

    Ok(builder.build())
}

pub async fn send_otp_email(
    config: &Config,
    to_email: &str,
    otp_code: &str,
) -> Result<(), AppError> {
    let invalid = |what: &str, e: &dyn std::fmt::Display| {
        tracing::error!("Invalid {what} for OTP email: {e}");
        AppError::InternalServerError("Sähköpostikoodin lähetys epäonnistui.".to_string())
    };

    let from: Mailbox = config
        .smtp_from_email
        .parse()
        .map_err(|e| invalid("SMTP_FROM_EMAIL", &e))?;
    let to: Mailbox = to_email.parse().map_err(|e| invalid("recipient", &e))?;

    let message = Message::builder()
        .from(from)
        .to(to)
        .subject("Kirjautumiskoodisi - Varauskalenteri")
        .header(ContentType::TEXT_HTML)
        .body(otp_html(otp_code))
        .map_err(|e| invalid("message", &e))?;

    build_transport(config)?.send(message).await.map_err(|e| {
        tracing::error!("SMTP send error: {e}");
        AppError::InternalServerError("Sähköpostikoodin lähetys epäonnistui.".to_string())
    })?;

    Ok(())
}
