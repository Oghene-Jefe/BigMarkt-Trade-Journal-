import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name") ?? "Trader";
  const username = searchParams.get("username") ?? "";
  const trades = searchParams.get("trades") ?? "0";
  const wr = searchParams.get("wr") ?? "0";

  const winRate = parseFloat(wr);
  const wrDisplay = Number.isFinite(winRate) ? `${winRate.toFixed(1)}%` : "—";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0a0a",
          fontFamily: "sans-serif",
          padding: "60px",
          position: "relative",
        }}
      >
        {/* Gold top border accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            backgroundColor: "#D4AF37",
          }}
        />

        {/* BigMarkt logo top-left */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "#D4AF37",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            BigMarkt
          </span>
          <span
            style={{
              fontSize: "13px",
              color: "rgba(255,255,255,0.4)",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginLeft: "4px",
            }}
          >
            Verified Trading Journal
          </span>
        </div>

        {/* Trader name — centred vertically in remaining space */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              fontSize: "64px",
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              maxWidth: "900px",
            }}
          >
            {name}
          </div>
          {username ? (
            <div
              style={{
                marginTop: "12px",
                fontSize: "24px",
                color: "#D4AF37",
                letterSpacing: "0.04em",
              }}
            >
              @{username}
            </div>
          ) : null}

          {/* Stat boxes */}
          <div
            style={{
              display: "flex",
              gap: "20px",
              marginTop: "40px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                border: "1px solid rgba(255,255,255,0.15)",
                backgroundColor: "rgba(255,255,255,0.04)",
                padding: "20px 32px",
                minWidth: "180px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: "rgba(255,255,255,0.45)",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  marginBottom: "8px",
                }}
              >
                Trades
              </span>
              <span
                style={{
                  fontSize: "40px",
                  fontWeight: 700,
                  color: "#D4AF37",
                  lineHeight: 1,
                }}
              >
                {trades}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                border: "1px solid rgba(255,255,255,0.15)",
                backgroundColor: "rgba(255,255,255,0.04)",
                padding: "20px 32px",
                minWidth: "180px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: "rgba(255,255,255,0.45)",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  marginBottom: "8px",
                }}
              >
                Win Rate
              </span>
              <span
                style={{
                  fontSize: "40px",
                  fontWeight: 700,
                  color: winRate >= 50 ? "#4ade80" : "#f87171",
                  lineHeight: 1,
                }}
              >
                {wrDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              color: "rgba(255,255,255,0.3)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Verified Trading Record
          </span>
          <span
            style={{
              fontSize: "13px",
              color: "rgba(255,255,255,0.3)",
            }}
          >
            journal.bigmarkt.co
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
