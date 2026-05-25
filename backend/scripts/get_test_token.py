"""get_test_token.py — mint a Clerk JWT for a demo user, for backend testing.

Clerk's current dashboard no longer has a per-template "preview token" button,
so this is the substitute. It uses your Clerk secret key to:

  1. Look up the user by email (Backend API)
  2. Mint a sign-in token for them            (Backend API)
  3. Exchange the sign-in token for a session (Frontend API, via the
     instance's hosted accounts URL)
  4. Render that session as a JWT through the named JWT template (Backend API)

Usage:
    cd backend && source bin/activate
    python -m scripts.get_test_token --email client-apple@example.com
    # prints the JWT on stdout

    # Pipe into a curl test:
    TOKEN=$(python -m scripts.get_test_token --email client-apple@example.com)
    curl -s http://localhost:8000/me -H "Authorization: Bearer $TOKEN" | jq

Reads CLERK_SECRET_KEY and CLERK_JWKS_URL from backend/.env.local.
"""

from __future__ import annotations

import sys
from pathlib import Path

import httpx
import typer

# Allow `python scripts/get_test_token.py` from backend/ to import app.*
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.settings import get_settings  # noqa: E402

CLERK_BACKEND = "https://api.clerk.com/v1"

app = typer.Typer(add_completion=False, help="Mint a Clerk JWT for backend curl tests.")


def _backend_headers(secret: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {secret}", "Content-Type": "application/json"}


def _frontend_base(jwks_url: str) -> str:
    """Derive the instance's Frontend API base from the JWKS URL.

    JWKS URL:    https://<instance>.clerk.accounts.dev/.well-known/jwks.json
    Frontend:    https://<instance>.clerk.accounts.dev
    """
    return jwks_url.replace("/.well-known/jwks.json", "")


def find_user_id(secret: str, email: str) -> str:
    r = httpx.get(
        f"{CLERK_BACKEND}/users",
        params={"email_address": [email]},
        headers=_backend_headers(secret),
        timeout=10,
    )
    r.raise_for_status()
    users = r.json()
    if not users:
        typer.secho(f"No Clerk user with email {email!r}.", fg="red", err=True)
        raise typer.Exit(1)
    return users[0]["id"]


def mint_sign_in_token(secret: str, user_id: str) -> str:
    r = httpx.post(
        f"{CLERK_BACKEND}/sign_in_tokens",
        json={"user_id": user_id, "expires_in_seconds": 600},
        headers=_backend_headers(secret),
        timeout=10,
    )
    r.raise_for_status()
    return r.json()["token"]


def exchange_for_session(frontend_base: str, ticket: str) -> str:
    """POST the ticket to the Frontend API's sign_ins endpoint to create a session."""
    r = httpx.post(
        f"{frontend_base}/v1/client/sign_ins",
        params={"strategy": "ticket", "ticket": ticket},
        timeout=10,
    )
    r.raise_for_status()
    body = r.json()
    # Response shape: {"response": {"created_session_id": "sess_xxx", ...}, "client": {...}}
    session_id = body.get("response", {}).get("created_session_id")
    if not session_id:
        typer.secho(
            f"Sign-in succeeded but no session_id in response:\n{body}", fg="red", err=True
        )
        raise typer.Exit(1)
    return session_id


def render_jwt(secret: str, session_id: str, template: str) -> str:
    r = httpx.post(
        f"{CLERK_BACKEND}/sessions/{session_id}/tokens/{template}",
        headers=_backend_headers(secret),
        timeout=10,
    )
    if r.status_code == 404:
        typer.secho(
            f"Template {template!r} not found. Check JWT Templates in the Clerk dashboard.",
            fg="red", err=True,
        )
        raise typer.Exit(1)
    r.raise_for_status()
    return r.json()["jwt"]


@app.command()
def main(
    email: str = typer.Option(..., help="Email of the demo user (e.g. client-apple@example.com)."),
    template: str = typer.Option("forthea", help="JWT template name to render."),
) -> None:
    settings = get_settings()
    if not settings.clerk_secret_key:
        typer.secho("CLERK_SECRET_KEY not set in backend/.env.local.", fg="red", err=True)
        raise typer.Exit(1)
    if not settings.clerk_jwks_url:
        typer.secho("CLERK_JWKS_URL not set in backend/.env.local.", fg="red", err=True)
        raise typer.Exit(1)

    secret = settings.clerk_secret_key
    frontend = _frontend_base(settings.clerk_jwks_url)

    user_id = find_user_id(secret, email)
    ticket = mint_sign_in_token(secret, user_id)
    session_id = exchange_for_session(frontend, ticket)
    jwt_str = render_jwt(secret, session_id, template)
    typer.echo(jwt_str)


if __name__ == "__main__":
    app()
