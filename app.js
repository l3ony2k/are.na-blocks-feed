(function () {
  "use strict";

  var DEFAULT_LOADER_TEXT = "Loading more...";
  var ALLOWED_CLASSES = { Text: 1, Media: 1, Image: 1, Link: 1 };
  var ARENA_API_BASE = "https://api.are.na/v2/channels/";

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  function renderBlock(block) {
    var date = new Date(block.created_at);
    var dateLabel = formatDate(date);
    var blockId = String(block.id);
    var rendered = "";

    if (block["class"] === "Text") {
      if (block.content_html) {
        rendered = block.content_html;
      } else {
        var safe = block.content ? escapeHtml(block.content) : "";
        rendered = "<p>" + safe.replace(/\n/g, "<br>") + "</p>";
      }
    } else if (block["class"] === "Image") {
      var altText = block.content ? escapeHtml(block.content) : "Are.na block " + block.id;
      if (block.image && block.image.display && block.image.display.url) {
        rendered =
          '<img src="' +
          block.image.display.url +
          '" alt="' +
          altText +
          '" style="max-width:100%; height:auto;"/>';
      }
    } else if (block["class"] === "Media") {
      if (block.embed && block.embed.html) {
        rendered = '<div class="embed-container">' + block.embed.html + "</div>";
      } else if (block.image && block.image.display && block.image.display.url) {
        var altText2 = block.content ? escapeHtml(block.content) : "Are.na block " + block.id;
        rendered =
          '<img src="' +
          block.image.display.url +
          '" alt="' +
          altText2 +
          '" style="max-width:100%; height:auto;"/>';
      } else if (block.source && block.source.url) {
        var altText3 = block.content ? escapeHtml(block.content) : "Are.na block " + block.id;
        rendered =
          '<img src="' +
          block.source.url +
          '" alt="' +
          altText3 +
          '" style="max-width:100%; height:auto;"/>';
      }
    } else if (block["class"] === "Link") {
      var thumbHtml = "";
      if (block.image && block.image.thumb && block.image.thumb.url) {
        var altText4 = block.title ? escapeHtml(block.title) : "";
        thumbHtml =
          '<img src="' + block.image.thumb.url + '" alt="' + altText4 + '" class="link-thumb"/>';
      }
      var descHtml = "";
      if (block.description_html) {
        descHtml = '<div class="link-description">' + block.description_html + "</div>";
      }
      var buttonHtml = "";
      if (block.source && block.source.url) {
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

    var titleElement = "";
    if (block.title && block.title.trim()) {
      var titleHtml = escapeHtml(block.title.trim());
      if (block.description_html && block.description_html.trim()) {
        var tooltipId = "tooltip-" + block.id;
        titleElement =
          '<div class="thought-title" data-tooltip-id="' +
          tooltipId +
          '">' +
          titleHtml +
          "</div>" +
          '<div class="tooltip-content" id="' +
          tooltipId +
          '" style="display: none;">' +
          block.description_html +
          "</div>";
      } else {
        titleElement = '<div class="thought-title">' + titleHtml + "</div>";
      }
    }

    return (
      '<section class="thought-container" id="' +
      blockId +
      '" data-type="' +
      block["class"].toLowerCase() +
      '">' +
      '<div class="thought-header">' +
      '<div class="thought-date"><a class="thought-date" href="#' +
      blockId +
      '">' +
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

  function filterAndSortBlocks(blocks) {
    return blocks
      .filter(function (b) {
        return ALLOWED_CLASSES[b["class"]];
      })
      .sort(function (a, b) {
        return b.position - a.position;
      });
  }

  function renderBlocksHtml(blocks) {
    return blocks.map(renderBlock).join("\n");
  }

  function parseConfig() {
    var configElement = document.getElementById("blocks-config");
    if (!configElement) return null;
    var raw = (configElement.textContent || "").trim();
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.error("Failed to parse blocks config", error);
      return null;
    }
  }

  function buildHeaders(config) {
    var headers = { Accept: "application/json" };
    if (config.accessToken) {
      headers["Authorization"] = "Bearer " + config.accessToken;
    }
    return headers;
  }

  async function fetchChannelInfo(slug, headers) {
    var url = ARENA_API_BASE + encodeURIComponent(slug);
    var response = await fetch(url, { headers: headers });
    if (!response.ok) {
      throw new Error("Failed to fetch channel info: " + response.status);
    }
    return response.json();
  }

  async function fetchChannelPage(slug, page, perPage, headers) {
    var params = new URLSearchParams({
      per: String(perPage),
      page: String(page),
      sort: "position",
      direction: "desc",
    });
    var url = ARENA_API_BASE + encodeURIComponent(slug) + "?" + params.toString();
    var response = await fetch(url, { headers: headers });
    if (!response.ok) {
      throw new Error("Failed to fetch page " + page + ": " + response.status);
    }
    return response.json();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var contentArea = document.getElementById("content-area");
    var inner = contentArea ? contentArea.querySelector(".content-inner") : null;
    if (!inner) return;

    var config = parseConfig();
    if (!config || !config.channelSlug) return;

    var slug = config.channelSlug;
    var pageSize = config.pageSize || 40;
    var headers = buildHeaders(config);

    var initialLoader = document.getElementById("initial-loader");
    var totalPages = 1;
    var currentPage = 0;

    var observer = null;
    var loadingPromise = null;

    var sentinel = document.createElement("div");
    sentinel.id = "pagination-sentinel";
    sentinel.setAttribute("aria-hidden", "true");

    var loader = document.createElement("div");
    loader.id = "infinite-loader";
    loader.textContent = DEFAULT_LOADER_TEXT;

    function setLoaderVisible(visible) {
      if (visible) {
        loader.textContent = DEFAULT_LOADER_TEXT;
        loader.classList.remove("error");
        loader.classList.add("active");
      } else if (!loader.classList.contains("error")) {
        loader.classList.remove("active");
      }
    }

    function showLoaderError(message) {
      loader.textContent = message;
      loader.classList.add("error", "active");
    }

    function appendHtml(html) {
      if (!html) return;
      var template = document.createElement("template");
      template.innerHTML = html;
      inner.insertBefore(template.content, sentinel);
    }

    function showError(message) {
      if (initialLoader) {
        initialLoader.textContent = "";
        initialLoader.innerHTML =
          '<div class="initial-error">' +
          escapeHtml(message) +
          "<br><br>" +
          '<a href="https://www.are.na/channel/' +
          encodeURIComponent(slug) +
          '" target="_blank" rel="noopener">Visit the original channel on Are.na →</a>' +
          "</div>";
      }
    }

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
          var blocks = filterAndSortBlocks(pageData.contents || []);
          var html = renderBlocksHtml(blocks);
          currentPage = nextPage;

          if (html.trim()) {
            appendHtml(html);
            if (typeof window.initializeThoughtEnhancements === "function") {
              window.initializeThoughtEnhancements();
            }
          }

          if (currentPage >= totalPages) {
            if (observer) observer.disconnect();
          }

          return true;
        } catch (error) {
          console.error("Unable to load additional Are.na blocks", error);
          showLoaderError("Unable to load more right now.");
          if (observer) observer.disconnect();
          return false;
        } finally {
          if (!loader.classList.contains("error")) {
            setLoaderVisible(false);
          }
          loadingPromise = null;
        }
      })();

      return loadingPromise;
    }

    // Initial load: fetch channel info + first page together, then render
    (async function () {
      try {
        // Step 1: Get channel info to know total block count
        var channelInfo = await fetchChannelInfo(slug, headers);
        var totalBlocks = channelInfo.length || 0;
        totalPages = totalBlocks > 0 ? Math.ceil(totalBlocks / pageSize) : 1;

        // Step 2: Fetch first page of blocks
        var firstPageData = await fetchChannelPage(slug, 1, pageSize, headers);
        var firstBlocks = filterAndSortBlocks(firstPageData.contents || []);
        var firstHtml = renderBlocksHtml(firstBlocks);
        currentPage = 1;

        // Step 3: Swap loading indicator for actual content in one go
        if (initialLoader) {
          initialLoader.remove();
        }

        if (firstHtml.trim()) {
          var template = document.createElement("template");
          template.innerHTML = firstHtml;
          inner.appendChild(template.content);
        }

        if (typeof window.initializeThoughtEnhancements === "function") {
          window.initializeThoughtEnhancements();
        }

        // Step 4: Only set up pagination if there are more pages
        if (totalPages > 1) {
          inner.appendChild(sentinel);
          inner.appendChild(loader);

          observer = new IntersectionObserver(
            function (entries) {
              entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                  loadNextPage();
                }
              });
            },
            {
              root: contentArea || null,
              rootMargin: "200px",
              threshold: 0.1,
            }
          );

          observer.observe(sentinel);
        }

        // Handle hash navigation
        var targetBlockId = window.location.hash ? window.location.hash.slice(1) : "";
        var targetResolved = !targetBlockId;

        var ensureTargetBlock = async function () {
          if (!targetBlockId || targetResolved) return;

          var block = document.getElementById(targetBlockId);
          while (!block && currentPage < totalPages) {
            var loaded = await loadNextPage();
            if (!loaded) break;
            block = document.getElementById(targetBlockId);
          }

          if (block) {
            block.scrollIntoView({ behavior: "smooth", block: "start" });
            targetResolved = true;
          } else if (currentPage >= totalPages) {
            targetResolved = true;
          }
        };

        if (targetBlockId) {
          ensureTargetBlock();
        }

        window.addEventListener("hashchange", function () {
          targetBlockId = window.location.hash ? window.location.hash.slice(1) : "";
          targetResolved = !targetBlockId;
          if (targetBlockId) {
            ensureTargetBlock();
          }
        });
      } catch (error) {
        console.error("Failed to load channel", error);
        showError("Failed to load channel: " + error.message);
      }
    })();
  });
})();
