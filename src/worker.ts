/* eslint-disable @typescript-eslint/no-unused-vars */
import templateHtml from '../index.html';
import styleCss from '../style.css';
import themeJs from '../theme.js';

type Env = {
  CHANNEL_SLUG: string;
  ARENA_ACCESS_TOKEN?: string;
};

// Cache TTL for the Are.na API response and generated HTML (in seconds)
const CACHE_TTL = 300; // 5 minutes

// Util: escape HTML entities to avoid injection
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Util: format date as "YYYY-MM-DD @ HH:MM"
function formatDate(date: Date): string {
  const pad = (n: number) => (n < 10 ? '0' + n : n.toString());
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} @ ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Serve static assets directly from in-memory constants
    if (url.pathname === '/style.css') {
      return new Response(styleCss, {
        headers: { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'public, max-age=31536000, immutable' },
      });
    }
    if (url.pathname === '/theme.js') {
      return new Response(themeJs, {
        headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'public, max-age=31536000, immutable' },
      });
    }

    // Only root path serves the page
    if (url.pathname !== '/') {
      return new Response('Not found', { status: 404 });
    }

    // Try edge cache for rendered HTML first
    const cacheKey = new Request(request.url, request);
    // Cast to any to satisfy TypeScript for caches.default
    const cache = (caches as any).default as Cache;
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Fetch Are.na channel contents with pagination
    const slug = env.CHANNEL_SLUG;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (env.ARENA_ACCESS_TOKEN) {
      headers['Authorization'] = `Bearer ${env.ARENA_ACCESS_TOKEN}`;
    }

    interface ArenaBlock {
      id: number;
      created_at: string;
      position: number;
      class: string;
      content?: string;
      content_html?: string;
      title?: string;
      description?: string;
      description_html?: string;
      source?: { url: string };
      image?: {
        display: { url: string };
        large: { url: string };
        original: { url: string };
        thumb?: { url: string };
      };
      embed?: {
        html: string;
        type: string;
        title?: string;
        author_name?: string;
        width?: number;
        height?: number;
      };
    }

    interface ArenaChannelResponse {
      contents: ArenaBlock[];
      length: number;
    }

    // First, get the channel info to know total count
    const channelInfoUrl = `https://api.are.na/v2/channels/${encodeURIComponent(slug)}`;
    const channelInfoResp = await fetch(channelInfoUrl, {
      headers,
      // @ts-ignore - Cloudflare-specific property
      cf: { cacheTtl: CACHE_TTL, cacheEverything: true },
    } as RequestInit);

    if (!channelInfoResp.ok) {
      return new Response(`Failed to fetch Are.na channel info: ${channelInfoResp.status}`, { status: 500 });
    }

    const channelInfo = (await channelInfoResp.json()) as ArenaChannelResponse;
    const totalBlocks = channelInfo.length;
    const perPage = 100; // Are.na max per page
    const totalPages = Math.ceil(totalBlocks / perPage);

    // Create paginated requests for all pages
    const pagePromises: Promise<Response>[] = [];
    for (let page = 1; page <= totalPages; page++) {
      const apiUrl = `https://api.are.na/v2/channels/${encodeURIComponent(slug)}?per=${perPage}&page=${page}`;
      const pagePromise = fetch(apiUrl, {
        headers,
        // @ts-ignore - Cloudflare-specific property
        cf: { cacheTtl: CACHE_TTL, cacheEverything: true },
      } as RequestInit);
      pagePromises.push(pagePromise);
    }

    // Execute all requests concurrently
    const pageResponses = await Promise.all(pagePromises);
    
    // Check all responses are successful
    for (const resp of pageResponses) {
      if (!resp.ok) {
        return new Response(`Failed to fetch Are.na channel page: ${resp.status}`, { status: 500 });
      }
    }

    // Parse all responses and combine contents
    const pageDataPromises = pageResponses.map(resp => resp.json() as Promise<ArenaChannelResponse>);
    const allPageData = await Promise.all(pageDataPromises);
    
    // Combine all contents from all pages
    const allBlocks: ArenaBlock[] = [];
    for (const pageData of allPageData) {
      allBlocks.push(...pageData.contents);
    }

    const blocksHtml = allBlocks
      .filter((b) => b.class === 'Text' || b.class === 'Media' || b.class === 'Image' || b.class === 'Link')
      .sort((a, b) => b.position - a.position) // Sort by position: largest number first (top), smallest last
      .map((block) => {
        const date = new Date(block.created_at);
        const dateLabel = formatDate(date);
        const blockId = `${block.id}`;

        let rendered = '';
        if (block.class === 'Text') {
          // Use content_html if available, otherwise fall back to content with HTML escaping
          if (block.content_html) {
            // content_html is already safe HTML from Are.na
            rendered = block.content_html;
          } else {
            const safe = block.content ? escapeHtml(block.content) : '';
            // Convert simple line breaks to <br>
            rendered = `<p>${safe.replace(/\n/g, '<br>')}</p>`;
          }
        } else if (block.class === 'Image') {
          // Image rendering using the image field
          const altText = block.content ? escapeHtml(block.content) : `Are.na block ${block.id}`;
          if (block.image && block.image.display && block.image.display.url) {
            rendered = `<img src="${block.image.display.url}" alt="${altText}" style="max-width:100%; height:auto;"/>`;
          }
        } else if (block.class === 'Media') {
          // Media rendering - prioritize embed HTML for videos, fallback to image
          if (block.embed && block.embed.html) {
            // Use the embed HTML directly (it's already an iframe from Are.na)
            rendered = `<div class="embed-container">${block.embed.html}</div>`;
            
            // Add title and description if available
            // if (block.title) {
            //   rendered = `<h3 class="media-title">${escapeHtml(block.title)}</h3>` + rendered;
            // }
            // if (block.description) {
            //   rendered += `<div class="media-description">${escapeHtml(block.description).replace(/\n/g, '<br>')}</div>`;
            // }
          } else if (block.image && block.image.display && block.image.display.url) {
            // Fallback to image rendering
            const altText = block.content ? escapeHtml(block.content) : `Are.na block ${block.id}`;
            rendered = `<img src="${block.image.display.url}" alt="${altText}" style="max-width:100%; height:auto;"/>`;
          } else if (block.source && block.source.url) {
            // Last fallback to source URL as image
            const altText = block.content ? escapeHtml(block.content) : `Are.na block ${block.id}`;
            rendered = `<img src="${block.source.url}" alt="${altText}" style="max-width:100%; height:auto;"/>`;
          }
        } else if (block.class === 'Link') {
          let thumbHtml = '';
          if (block.image && block.image.thumb && block.image.thumb.url) {
            const altText = block.title ? escapeHtml(block.title) : '';
            thumbHtml = `<img src="${block.image.thumb.url}" alt="${altText}" class="link-thumb"/>`;
          }

          let descriptionHtml = '';
          if (block.description_html) {
            descriptionHtml = `<div class="link-description">${block.description_html}</div>`;
          }

          let buttonHtml = '';
          if (block.source && block.source.url) {
            buttonHtml = `<a href="${block.source.url}" target="_blank" rel="noopener" class="link-button">Go to original</a>`;
          }

          rendered = `<div class="link-container">
                        ${thumbHtml}
                        <div class="link-main">
                          ${descriptionHtml}
                          ${buttonHtml}
                        </div>
                      </div>`;
        }

        // Generate title element if title exists
        let titleElement = '';
        if (block.title && block.title.trim()) {
          const titleHtml = escapeHtml(block.title.trim());
          if (block.description_html && block.description_html.trim()) {
            // Title with tooltip - store HTML content in data attribute for JS handling
            const tooltipId = `tooltip-${block.id}`;
            titleElement = `<div class="thought-title" data-tooltip-id="${tooltipId}">${titleHtml}</div>
                           <div class="tooltip-content" id="${tooltipId}" style="display: none;">${block.description_html}</div>`;
          } else {
            // Title without tooltip
            titleElement = `<div class="thought-title">${titleHtml}</div>`;
          }
        }

        return `<section class="thought-container" id="${blockId}" data-type="${block.class.toLowerCase()}">
                  <div class="thought-header">
                    <div class="thought-date"><a class="thought-date" href="#${blockId}">${dateLabel}</a></div>
                    ${titleElement}
                  </div>
                  <div class="thought-content">${rendered}</div>
                </section>`;
      })
      .join('\n');

    const html = templateHtml.replace('<!--THOUGHTS-->', blocksHtml);

    const response = new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': `public, max-age=${CACHE_TTL}`,
      },
    });

    // Put rendered page into edge cache without blocking response
    // @ts-ignore - ExecutionContext typing is minimal
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
}; 