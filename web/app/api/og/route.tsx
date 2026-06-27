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
  const wrColor = winRate >= 50 ? "#4ade80" : "#f87171";

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
        }}
      >
        {/* Gold top bar — flex child, no absolute positioning */}
        <div style={{ width: "1200px", height: "4px", backgroundColor: "#D4AF37", display: "flex" }} />

        {/* Main content area */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            padding: "48px 60px 40px 60px",
          }}
        >
          {/* Logo row */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <span
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#D4AF37",
                textTransform: "uppercase",
                letterSpacing: "2px",
              }}
            >
              BigMarkt
            </span>
            <span
              style={{
                fontSize: "12px",
                color: "#555555",
                textTransform: "uppercase",
                letterSpacing: "2px",
                marginLeft: "12px",
              }}
            >
              Verified Trading Journal
            </span>
          </div>

          {/* Trader name */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flexGrow: 1,
              justifyContent: "center",
            }}
          >
            <div
              style={{
                fontSize: "62px",
                fontWeight: 800,
                color: "#ffffff",
                lineHeight: "1.05",
              }}
            >
              {name}
            </div>

            {username ? (
              <div
                style={{
                  fontSize: "22px",
                  color: "#D4AF37",
                  marginTop: "10px",
                }}
              >
                @{username}
              </div>
            ) : null}

            {/* Stat boxes */}
            <div style={{ display: "flex", marginTop: "36px" }}>
              {/* Trades box */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: "#2a2a2a",
                  backgroundColor: "#111111",
                  padding: "18px 28px",
                  marginRight: "16px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    color: "#666666",
                    textTransform: "uppercase",
                    letterSpacing: "2px",
                    marginBottom: "8px",
                  }}
                >
                  Trades
                </span>
                <span
                  style={{
                    fontSize: "38px",
                    fontWeight: 700,
                    color: "#D4AF37",
                    lineHeight: "1",
                  }}
                >
                  {trades}
                </span>
              </div>

              {/* Win rate box */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: "#2a2a2a",
                  backgroundColor: "#111111",
                  padding: "18px 28px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    color: "#666666",
                    textTransform: "uppercase",
                    letterSpacing: "2px",
                    marginBottom: "8px",
                  }}
                >
                  Win Rate
                </span>
                <span
                  style={{
                    fontSize: "38px",
                    fontWeight: 700,
                    color: wrColor,
                    lineHeight: "1",
                  }}
                >
                  {wrDisplay}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#444444", textTransform: "uppercase", letterSpacing: "2px" }}>
              Verified Trading Record
            </span>
            <span style={{ fontSize: "12px", color: "#444444" }}>
              journal.bigmarkt.co
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
