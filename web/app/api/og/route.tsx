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
  const wrDisplay = Number.isFinite(winRate) ? `${winRate.toFixed(1)}%` : "0.0%";

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0a0a",
          fontFamily: "sans-serif",
        }}
      >
        {/* Gold top bar */}
        <div
          style={{
            display: "flex",
            width: 1200,
            height: 4,
            backgroundColor: "#D4AF37",
          }}
        />

        {/* Main content: logo row, name section, footer stacked vertically */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            paddingTop: 48,
            paddingBottom: 40,
            paddingLeft: 60,
            paddingRight: 60,
          }}
        >
          {/* Logo row */}
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#D4AF37",
                letterSpacing: 2,
              }}
            >
              BIGMARKT
            </span>
            <span
              style={{
                fontSize: 12,
                color: "#555555",
                letterSpacing: 2,
                marginLeft: 12,
              }}
            >
              VERIFIED TRADING JOURNAL
            </span>
          </div>

          {/* Spacer + name + username + stats */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flexGrow: 1,
              justifyContent: "center",
            }}
          >
            {/* Trader name */}
            <div
              style={{
                display: "flex",
                fontSize: 62,
                fontWeight: 700,
                color: "#ffffff",
                lineHeight: 1,
              }}
            >
              {name}
            </div>

            {/* Username */}
            <div
              style={{
                display: "flex",
                fontSize: 22,
                color: "#D4AF37",
                marginTop: 10,
              }}
            >
              {username ? `@${username}` : " "}
            </div>

            {/* Stat boxes row */}
            <div style={{ display: "flex", flexDirection: "row", marginTop: 36 }}>
              {/* Trades box */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: "#2a2a2a",
                  backgroundColor: "#111111",
                  paddingTop: 18,
                  paddingBottom: 18,
                  paddingLeft: 28,
                  paddingRight: 28,
                  marginRight: 16,
                }}
              >
                <span style={{ fontSize: 11, color: "#666666", marginBottom: 8 }}>
                  TRADES
                </span>
                <span style={{ fontSize: 46, fontWeight: 700, color: "#D4AF37", lineHeight: 1 }}>
                  {trades}
                </span>
              </div>

              {/* Win rate box */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: "#2a2a2a",
                  backgroundColor: "#111111",
                  paddingTop: 18,
                  paddingBottom: 18,
                  paddingLeft: 28,
                  paddingRight: 28,
                }}
              >
                <span style={{ fontSize: 11, color: "#666666", marginBottom: 8 }}>
                  WIN RATE
                </span>
                <span style={{ fontSize: 46, fontWeight: 700, color: "#D4AF37", lineHeight: 1 }}>
                  {wrDisplay}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 12, color: "#444444" }}>
              VERIFIED TRADING RECORD
            </span>
            <span style={{ fontSize: 12, color: "#444444" }}>
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
