(function () {
  "use strict";

  // =========================================
  //  embed.js — Are.na Journal Feed Embed
  //  Self-contained script for embedding the
  //  journal feed into external pages.
  //  Served at: journal.lok.computer/embed.js
  // =========================================

  // --- Constants ---
  var ARENA_API_BASE = "https://api.are.na/v3";
  var ALLOWED_KINDS = { text: 1, image: 1, link: 1, attachment: 1, embed: 1 };
  var DEFAULT_PAGE_SIZE = 20;
  var DEFAULT_CHANNEL = "journaling-and-healing";
  var LOADER_TEXT = "Loading more...";

  // =========================================
  //  1. Mount Point Detection
  // =========================================

  var mount = document.getElementById("arena-journal-feed");
  if (!mount) return;

  // Read config from data attributes (extensible for future options)
  var config = {
    channel: mount.getAttribute("data-channel") || DEFAULT_CHANNEL,
    pageSize: parseInt(mount.getAttribute("data-page-size") || String(DEFAULT_PAGE_SIZE), 10),
    accessToken: mount.getAttribute("data-token") || "",
  };

  // =========================================
  //  2. Utility Functions
  // =========================================

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getString(value) {
    return typeof value === "string" ? value : "";
  }

  function formatDate(date) {
    var pad = function (n) {
      return n < 10 ? "0" + n : String(n);
    };
    return (
      date.getFullYear() +
      "-" +
      pad(date.getMonth() + 1) +
      "-" +
      pad(date.getDate()) +
      " @ " +
      pad(date.getHours()) +
      ":" +
      pad(date.getMinutes())
    );
  }

  // =========================================
  //  3. Data Normalization
  // =========================================

  function normalizeRichText(value) {
    if (!value) return { html: "", plain: "", markdown: "" };
    if (typeof value === "string") return { html: "", plain: value, markdown: value };
    return {
      html: getString(value.html),
      plain: getString(value.plain),
      markdown: getString(value.markdown),
    };
  }

  function normalizeSource(source) {
    if (!source) return { url: "", title: "", providerName: "" };
    return {
      url: getString(source.url),
      title: getString(source.title),
      providerName: source.provider ? getString(source.provider.name) : "",
    };
  }

  function normalizeConnection(connection) {
    return {
      id: connection && connection.id != null ? String(connection.id) : "",
      position: connection && typeof connection.position === "number" ? connection.position : 0,
      connectedAt: connection ? getString(connection.connected_at) : "",
    };
  }

  function normalizeOwner(user) {
    return {
      id: user && user.id != null ? String(user.id) : "",
      name: user ? getString(user.name) : "",
      slug: user ? getString(user.slug) : "",
    };
  }

  function normalizeImageVersions(image) {
    if (!image) return null;
    var thumb = (image.small && image.small.src) || (image.square && image.square.src) || image.src || "";
    var display = (image.medium && image.medium.src) || (image.large && image.large.src) || image.src || "";
    return {
      altText: getString(image.alt_text),
      thumb: thumb,
      display: display,
      original: getString(image.src),
      width: typeof image.width === "number" ? image.width : 0,
      height: typeof image.height === "number" ? image.height : 0,
    };
  }

  function normalizeChannel(rawChannel) {
    return {
      id: rawChannel && rawChannel.id != null ? String(rawChannel.id) : "",
      slug: rawChannel ? getString(rawChannel.slug) : "",
      title: rawChannel ? getString(rawChannel.title) : "",
      counts:
        rawChannel && rawChannel.counts
          ? {
              blocks: typeof rawChannel.counts.blocks === "number" ? rawChannel.counts.blocks : 0,
              contents: typeof rawChannel.counts.contents === "number" ? rawChannel.counts.contents : 0,
            }
          : { blocks: 0, contents: 0 },
      owner: normalizeOwner(rawChannel && rawChannel.owner),
    };
  }

  function normalizePageMeta(rawMeta) {
    return {
      currentPage: rawMeta && typeof rawMeta.current_page === "number" ? rawMeta.current_page : 1,
      totalPages: rawMeta && typeof rawMeta.total_pages === "number" ? rawMeta.total_pages : 1,
      totalCount: rawMeta && typeof rawMeta.total_count === "number" ? rawMeta.total_count : 0,
      hasMorePages: !!(rawMeta && rawMeta.has_more_pages),
    };
  }

  function normalizeAttachment(attachment) {
    if (!attachment) return null;
    return {
      url: getString(attachment.url),
      filename: getString(attachment.filename),
      contentType: getString(attachment.content_type),
      extension: getString(attachment.file_extension),
      fileSize: typeof attachment.file_size === "number" ? attachment.file_size : 0,
      imageVersions: normalizeImageVersions(attachment.image),
    };
  }

  function normalizeEmbed(embed) {
    if (!embed) return null;
    return {
      url: getString(embed.url),
      sourceUrl: getString(embed.source_url),
      type: getString(embed.type),
      title: getString(embed.title),
      authorName: getString(embed.author_name),
      authorUrl: getString(embed.author_url),
      providerName: getString(embed.provider_name),
      html: getString(embed.html),
      thumbnailUrl: getString(embed.thumbnail_url),
      width: typeof embed.width === "number" ? embed.width : 0,
      height: typeof embed.height === "number" ? embed.height : 0,
      imageVersions: normalizeImageVersions(embed.image),
    };
  }

  function normalizeBlock(rawBlock) {
    var kind = rawBlock ? getString(rawBlock.type).toLowerCase() : "";
    var content = normalizeRichText(rawBlock && rawBlock.content);
    var description = normalizeRichText(rawBlock && rawBlock.description);
    var imageVersions = normalizeImageVersions(rawBlock && rawBlock.image);
    var attachment = normalizeAttachment(rawBlock && rawBlock.attachment);
    var embed = normalizeEmbed(rawBlock && rawBlock.embed);
    var previewImage = imageVersions || (attachment && attachment.imageVersions) || (embed && embed.imageVersions);
    var primaryUrl =
      (attachment && attachment.url) ||
      (embed && (embed.sourceUrl || embed.url)) ||
      getString(rawBlock && rawBlock.source && rawBlock.source.url);

    return {
      id: rawBlock && rawBlock.id != null ? String(rawBlock.id) : "",
      kind: kind,
      title: rawBlock ? getString(rawBlock.title) : "",
      createdAt: rawBlock ? getString(rawBlock.created_at) : "",
      updatedAt: rawBlock ? getString(rawBlock.updated_at) : "",
      descriptionHtml: description.html,
      descriptionPlain: description.plain,
      textHtml: content.html,
      textPlain: content.plain,
      source: normalizeSource(rawBlock && rawBlock.source),
      owner: normalizeOwner(rawBlock && rawBlock.user),
      connection: normalizeConnection(rawBlock && rawBlock.connection),
      imageVersions: imageVersions,
      previewImage: previewImage,
      primaryUrl: primaryUrl,
      embedHtml: embed ? embed.html : "",
      attachment: attachment,
      embed: embed,
      arenaUrl: rawBlock && rawBlock.id != null ? "https://www.are.na/block/" + encodeURIComponent(rawBlock.id) : "",
    };
  }

  function normalizeBlocks(rawBlocks) {
    return (rawBlocks || [])
      .map(normalizeBlock)
      .filter(function (block) {
        return ALLOWED_KINDS[block.kind];
      })
      .sort(function (a, b) {
        return b.connection.position - a.connection.position;
      });
  }

  // =========================================
  //  4. Rendering
  // =========================================

  function getBlockAltText(block) {
    var alt =
      (block.imageVersions && block.imageVersions.altText) ||
      block.descriptionPlain ||
      block.textPlain ||
      block.title ||
      ("Are.na block " + block.id);
    return escapeHtml(alt);
  }

  function renderPlainText(text) {
    var safe = escapeHtml(text);
    return "<p>" + safe.replace(/\n/g, "<br>") + "</p>";
  }

  function renderBlock(block) {
    var date = new Date(block.createdAt);
    var dateLabel = formatDate(date);
    var blockId = String(block.id);
    var rendered = "";

    if (block.kind === "text") {
      rendered = block.textHtml || renderPlainText(block.textPlain);
    } else if (block.kind === "image") {
      if (block.previewImage && block.previewImage.display) {
        rendered =
          '<img src="' +
          block.previewImage.display +
          '" alt="' +
          getBlockAltText(block) +
          '" style="max-width:100%; height:auto;"/>';
      }
    } else if (block.kind === "embed") {
      if (block.embedHtml) {
        rendered = '<div class="embed-container">' + block.embedHtml + "</div>";
      } else if (block.previewImage && block.previewImage.display) {
        rendered =
          '<img src="' +
          block.previewImage.display +
          '" alt="' +
          getBlockAltText(block) +
          '" style="max-width:100%; height:auto;"/>';
      } else if (block.primaryUrl) {
        rendered =
          '<p><a href="' +
          block.primaryUrl +
          '" target="_blank" rel="noopener">Open embed</a></p>';
      }
    } else if (block.kind === "attachment") {
      if (block.previewImage && block.previewImage.display) {
        rendered =
          '<img src="' +
          block.previewImage.display +
          '" alt="' +
          getBlockAltText(block) +
          '" style="max-width:100%; height:auto;"/>';
      } else if (block.primaryUrl) {
        var attachmentLabel =
          (block.attachment && block.attachment.filename) ||
          (block.attachment && block.attachment.extension && "Open ." + block.attachment.extension) ||
          "Open attachment";
        rendered =
          '<p><a href="' +
          block.primaryUrl +
          '" target="_blank" rel="noopener">' +
          escapeHtml(attachmentLabel) +
          "</a></p>";
      }
    } else if (block.kind === "link") {
      var thumbHtml = "";
      if (block.previewImage && block.previewImage.thumb) {
        thumbHtml =
          '<img src="' +
          block.previewImage.thumb +
          '" alt="' +
          escapeHtml(block.title) +
          '" class="link-thumb"/>';
      }

      var descHtml = "";
      if (block.descriptionHtml) {
        descHtml = '<div class="link-description">' + block.descriptionHtml + "</div>";
      }

      var buttonHtml = "";
      if (block.source.url) {
        buttonHtml =
          '<a href="' +
          block.source.url +
          '" target="_blank" rel="noopener" class="link-button">Go to original</a>';
      }

      rendered =
        '<div class="link-container">' +
        thumbHtml +
        '<div class="link-main">' +
        descHtml +
        buttonHtml +
        "</div></div>";
    }

    // Title with optional tooltip
    var titleElement = "";
    if (block.title && block.title.trim()) {
      var titleHtml = escapeHtml(block.title.trim());
      if (block.descriptionHtml && block.descriptionHtml.trim()) {
        var tooltipId = "embed-tooltip-" + block.id;
        titleElement =
          '<div class="thought-title" data-tooltip-id="' +
          tooltipId +
          '">' +
          titleHtml +
          "</div>" +
          '<div class="tooltip-content" id="' +
          tooltipId +
          '" style="display: none;">' +
          block.descriptionHtml +
          "</div>";
      } else {
        titleElement = '<div class="thought-title">' + titleHtml + "</div>";
      }
    }

    return (
      '<section class="thought-container" id="embed-block-' +
      blockId +
      '" data-type="' +
      block.kind +
      '">' +
      '<div class="thought-header">' +
      '<div class="thought-date"><a class="thought-date" href="https://www.are.na/block/' +
      blockId +
      '" target="_blank" rel="noopener">' +
      dateLabel +
      "</a></div>" +
      titleElement +
      "</div>" +
      '<div class="thought-content">' +
      rendered +
      "</div>" +
      "</section>"
    );
  }

  function renderBlocksHtml(blocks) {
    return blocks.map(renderBlock).join("\n");
  }

  // =========================================
  //  5. API Layer
  // =========================================

  function buildHeaders() {
    var headers = { Accept: "application/json" };
    if (config.accessToken) {
      headers.Authorization = "Bearer " + config.accessToken;
    }
    return headers;
  }

  async function fetchJson(url, headers) {
    var response = await fetch(url, { headers: headers });
    var responseText = await response.text();
    var payload = null;

    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch (error) {
        payload = null;
      }
    }

    if (!response.ok) {
      var message =
        (payload && (payload.title || payload.error)) ||
        (payload && payload.errors && payload.errors[0] && payload.errors[0].message) ||
        responseText ||
        ("Request failed with status " + response.status);
      throw new Error(message);
    }

    if (!payload) {
      throw new Error("Received an invalid response from Are.na.");
    }

    return payload;
  }

  async function fetchChannel(slug, headers) {
    var url = ARENA_API_BASE + "/channels/" + encodeURIComponent(slug);
    var payload = await fetchJson(url, headers);
    return normalizeChannel(payload);
  }

  async function fetchChannelPage(slug, page, perPage, headers) {
    var params = new URLSearchParams({
      per: String(perPage),
      page: String(page),
      sort: "position_desc",
    });
    var url = ARENA_API_BASE + "/channels/" + encodeURIComponent(slug) + "/contents?" + params.toString();
    var payload = await fetchJson(url, headers);

    return {
      blocks: normalizeBlocks(payload.data),
      meta: normalizePageMeta(payload.meta),
    };
  }

  // =========================================
  //  6. Tooltip System
  // =========================================

  function setupTooltips(container) {
    var titleElements = container.querySelectorAll(".thought-title[data-tooltip-id]");

    titleElements.forEach(function (titleElement) {
      if (titleElement.getAttribute("data-tooltip-bound") === "true") return;

      var tooltipId = titleElement.getAttribute("data-tooltip-id");
      if (!tooltipId) return;

      var tooltipContent = document.getElementById(tooltipId);
      if (!tooltipContent) return;

      titleElement.setAttribute("data-tooltip-bound", "true");

      var hideTimeout = null;

      var showTooltip = function () {
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }

        tooltipContent.style.display = "block";

        var rect = titleElement.getBoundingClientRect();
        tooltipContent.style.left = rect.left + "px";
        tooltipContent.style.top = (rect.top - tooltipContent.offsetHeight - 10) + "px";

        var tooltipRect = tooltipContent.getBoundingClientRect();
        if (tooltipRect.left < 0) {
          tooltipContent.style.left = "10px";
        }
        if (tooltipRect.right > window.innerWidth) {
          tooltipContent.style.left = (window.innerWidth - tooltipRect.width - 10) + "px";
        }
        if (tooltipRect.top < 0) {
          tooltipContent.style.top = (rect.bottom + 10) + "px";
        }
      };

      var hideTooltip = function () {
        hideTimeout = window.setTimeout(function () {
          tooltipContent.style.display = "none";
          hideTimeout = null;
        }, 100);
      };

      var cancelHide = function () {
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }
      };

      titleElement.addEventListener("mouseenter", showTooltip);
      titleElement.addEventListener("mouseleave", hideTooltip);
      tooltipContent.addEventListener("mouseenter", cancelHide);
      tooltipContent.addEventListener("mouseleave", hideTooltip);
    });
  }

  // =========================================
  //  7. Feed Controller
  // =========================================

  function createFeedController(mountEl, feedConfig) {
    var slug = feedConfig.channel;
    var pageSize = feedConfig.pageSize;
    var headers = buildHeaders();

    // State
    var totalPages = 1;
    var currentPage = 0;
    var loadingPromise = null;
    var observer = null;

    // DOM structure
    var inner = document.createElement("div");
    inner.className = "embed-inner";

    var sentinel = document.createElement("div");
    sentinel.className = "embed-sentinel";
    sentinel.setAttribute("aria-hidden", "true");

    var loader = document.createElement("div");
    loader.className = "embed-loader";
    loader.textContent = LOADER_TEXT;
    loader.style.display = "none";

    // Clear mount and build structure
    mountEl.textContent = "";
    mountEl.appendChild(inner);
    mountEl.appendChild(sentinel);
    mountEl.appendChild(loader);

    // --- Helpers ---

    function setLoaderVisible(visible) {
      if (visible) {
        loader.textContent = LOADER_TEXT;
        loader.className = "embed-loader";
        loader.style.display = "block";
      } else if (!loader.classList.contains("embed-loader-error")) {
        loader.style.display = "none";
      }
    }

    function showLoaderError(message) {
      loader.textContent = message;
      loader.className = "embed-loader embed-loader-error";
      loader.style.display = "block";
    }

    function appendHtml(html) {
      if (!html) return [];
      var template = document.createElement("template");
      template.innerHTML = html;
      var newElements = Array.from(template.content.children);
      inner.appendChild(template.content);
      return newElements;
    }

    function showError(message) {
      mountEl.textContent = "";
      var errorDiv = document.createElement("div");
      errorDiv.className = "embed-error";
      errorDiv.innerHTML =
        escapeHtml(message) +
        "<br><br>" +
        '<a href="https://www.are.na/channel/' +
        encodeURIComponent(slug) +
        '" target="_blank" rel="noopener">Visit the original channel on Are.na →</a>';
      mountEl.appendChild(errorDiv);
    }

    // --- Scroll root detection ---
    // Find the scrollable ancestor (Bear Blog uses <main> with overflow-y: auto)
    function findScrollRoot() {
      var el = mountEl.parentElement;
      while (el && el !== document.documentElement) {
        var style = window.getComputedStyle(el);
        var overflowY = style.overflowY;
        if (overflowY === "auto" || overflowY === "scroll") {
          return el;
        }
        el = el.parentElement;
      }
      return null; // falls back to viewport
    }

    // --- Page loading ---

    async function loadNextPage() {
      if (loadingPromise) return loadingPromise;
      if (currentPage >= totalPages) {
        if (observer) observer.disconnect();
        return Promise.resolve(false);
      }

      var nextPage = currentPage + 1;

      loadingPromise = (async function () {
        setLoaderVisible(true);

        try {
          var pageData = await fetchChannelPage(slug, nextPage, pageSize, headers);
          var html = renderBlocksHtml(pageData.blocks);
          currentPage = pageData.meta.currentPage;
          totalPages = pageData.meta.totalPages || totalPages;

          if (html.trim()) {
            appendHtml(html);
            setupTooltips(inner);
          }

          if (!pageData.meta.hasMorePages || currentPage >= totalPages) {
            if (observer) observer.disconnect();
            loader.style.display = "none";
          }

          return true;
        } catch (error) {
          console.error("[embed.js] Unable to load Are.na blocks", error);
          showLoaderError("Unable to load more right now.");
          if (observer) observer.disconnect();
          return false;
        } finally {
          if (!loader.classList.contains("embed-loader-error")) {
            setLoaderVisible(false);
          }
          loadingPromise = null;
        }
      })();

      return loadingPromise;
    }

    // --- Initialize ---

    async function init() {
      try {
        var initialResults = await Promise.all([
          fetchChannel(slug, headers),
          fetchChannelPage(slug, 1, pageSize, headers),
        ]);

        var channel = initialResults[0];
        var firstPageData = initialResults[1];
        var totalBlocks =
          firstPageData.meta.totalCount || channel.counts.contents || channel.counts.blocks || 0;

        totalPages =
          firstPageData.meta.totalPages || (totalBlocks > 0 ? Math.ceil(totalBlocks / pageSize) : 1);
        currentPage = firstPageData.meta.currentPage;

        var firstHtml = renderBlocksHtml(firstPageData.blocks);
        if (firstHtml.trim()) {
          appendHtml(firstHtml);
          setupTooltips(inner);
        }

        // Set up infinite scroll if there are more pages
        if (totalPages > 1) {
          var scrollRoot = findScrollRoot();

          observer = new IntersectionObserver(
            function (entries) {
              entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                  loadNextPage();
                }
              });
            },
            {
              root: scrollRoot,
              rootMargin: "600px",
              threshold: 0,
            }
          );

          observer.observe(sentinel);

          // Fallback check in case sentinel is already visible
          setTimeout(function () {
            var rect = sentinel.getBoundingClientRect();
            if (rect.top < window.innerHeight + 600) {
              loadNextPage();
            }
          }, 500);
        }
      } catch (error) {
        console.error("[embed.js] Failed to load channel", error);
        showError("Failed to load journal feed: " + error.message);
      }
    }

    return { init: init };
  }

  // =========================================
  //  8. Bootstrap
  // =========================================

  // Run when DOM is ready
  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  onReady(function () {
    var feed = createFeedController(mount, config);
    feed.init();
  });
})();
