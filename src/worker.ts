/* eslint-disable @typescript-eslint/no-unused-vars */
import templateHtml from "../index.html";
import styleCss from "../style.css";
import themeJs from "../theme.js";
import appJs from "../app.js";
// @ts-ignore - WebP import handled by wrangler
import ogImage from "../og.webp";

type Env = {
  CHANNEL_SLUG: string;
  ARENA_ACCESS_TOKEN?: string;
};

const CACHE_TTL = 300; // 5 minutes
const PAGE_SIZE = 40; // Blocks per page for the main feed

function createConfigJson(slug: string, pageSize: number, token?: string): string {
  const config: Record<string, unknown> = {
    channelSlug: slug,
    pageSize,
  };
  if (token) {
    config.accessToken = token;
  }
  return JSON.stringify(config).replace(/</g, "\\u003c");
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/style.css") {
      return new Response(styleCss, {
        headers: {
          "content-type": "text/css; charset=utf-8",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }

    if (url.pathname === "/theme.js") {
      return new Response(themeJs, {
        headers: {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }

    if (url.pathname === "/app.js") {
      return new Response(appJs, {
        headers: {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }

    if (url.pathname === "/og.webp") {
      return new Response(ogImage, {
        headers: {
          "content-type": "image/webp",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }

    if (url.pathname !== "/" && url.pathname !== "/embed") {
      return new Response("Not found", { status: 404 });
    }

    const slug = env.CHANNEL_SLUG;
    const configJson = createConfigJson(slug, PAGE_SIZE, env.ARENA_ACCESS_TOKEN);

    if (url.pathname === "/embed") {
      const html = `<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta http-equiv="Cache-Control" content="no-store">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <!-- open graph -->
    <meta property="og:title" content="Leon's Journal" />
    <meta property="og:description" content="A page of things in my mind." />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Leon's Journal" />
    <meta property="og:image" content="/og.webp" />

    <link rel="stylesheet" type="text/css" href="/style.css">
    <title>Leon's Journal - Embed</title>
    <style>
      #header-bar, #footer-bar {
        display: none !important;
      }
      #content-area {
        padding: 0 1em !important;
        top: 0;
        bottom: 0;
      }
      .thought-container {
        margin: 1em 0 !important;
      }
    </style>
  </head>
  <body data-theme="system">
    <main id="content-area">
      <div class="content-inner">
        <div id="initial-loader" class="initial-loader">Loading...</div>
      </div>
    </main>
    <script id="blocks-config" type="application/json">${configJson}</script>
    <script src="/theme.js"></script>
    <script src="/app.js"></script>
  </body>
</html>`;

      return new Response(html, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": `public, max-age=${CACHE_TTL}`,
        },
      });
    }

    // Main page (/)
    let html = templateHtml.replace("__BLOCKS_CONFIG__", configJson);

    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": `public, max-age=${CACHE_TTL}`,
      },
    });
  },
};
