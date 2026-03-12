(function () {
  "use strict";

  var DEFAULT_LOADER_TEXT = "Loading more...";
  var ALLOWED_KINDS = { text: 1, media: 1, image: 1, link: 1 };
  var ARENA_API_BASE = "https://api.are.na/v3";

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

  function normalizeRichText(value) {
    if (!value) {
      return { html: "", plain: "", markdown: "" };
    }

    if (typeof value === "string") {
      return { html: "", plain: value, markdown: value };
    }

    return {
      html: getString(value.html),
      plain: getString(value.plain),
      markdown: getString(value.markdown),
    };
  }

  function normalizeSource(source) {
    if (!source) {
      return { url: "", title: "", providerName: "" };
    }

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
    if (!image) {
      return null;
    }

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

  function normalizeBlock(rawBlock) {
    var content = normalizeRichText(rawBlock && rawBlock.content);
    var description = normalizeRichText(rawBlock && rawBlock.description);
    var imageVersions = normalizeImageVersions(rawBlock && rawBlock.image);

    return {
      id: rawBlock && rawBlock.id != null ? String(rawBlock.id) : "",
      kind: rawBlock ? getString(rawBlock.type).toLowerCase() : "",
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
      embedHtml: rawBlock && rawBlock.embed ? getString(rawBlock.embed.html) : "",
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
      if (block.imageVersions && block.imageVersions.display) {
        rendered =
          '<img src="' +
          block.imageVersions.display +
          '" alt="' +
          getBlockAltText(block) +
          '" style="max-width:100%; height:auto;"/>';
      }
    } else if (block.kind === "media") {
      if (block.embedHtml) {
        rendered = '<div class="embed-container">' + block.embedHtml + "</div>";
      } else if (block.imageVersions && block.imageVersions.display) {
        rendered =
          '<img src="' +
          block.imageVersions.display +
          '" alt="' +
          getBlockAltText(block) +
          '" style="max-width:100%; height:auto;"/>';
      } else if (block.source.url) {
        rendered =
          '<img src="' +
          block.source.url +
          '" alt="' +
          getBlockAltText(block) +
          '" style="max-width:100%; height:auto;"/>';
      }
    } else if (block.kind === "link") {
      var thumbHtml = "";
      if (block.imageVersions && block.imageVersions.thumb) {
        thumbHtml =
          '<img src="' +
          block.imageVersions.thumb +
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

    var titleElement = "";
    if (block.title && block.title.trim()) {
      var titleHtml = escapeHtml(block.title.trim());
      if (block.descriptionHtml && block.descriptionHtml.trim()) {
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
          block.descriptionHtml +
          "</div>";
      } else {
        titleElement = '<div class="thought-title">' + titleHtml + "</div>";
      }
    }

    return (
      '<section class="thought-container" id="' +
      blockId +
      '" data-type="' +
      block.kind +
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
    var token = config && typeof config.accessToken === "string" ? config.accessToken.trim() : "";

    if (token) {
      headers.Authorization = "Bearer " + token;
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

  document.addEventListener("DOMContentLoaded", function () {
    var contentArea = document.getElementById("content-area");
    var inner = contentArea ? contentArea.querySelector(".content-inner") : null;
    if (!inner) return;

    var config = parseConfig();
    if (!config || !config.channelSlug) return;

    var slug = config.channelSlug;
    var pageSize = config.pageSize || 40;
    var headers = buildHeaders(config);
    var channelUrl = "https://www.are.na/channel/" + encodeURIComponent(slug);

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

    var msnry = null;
    var layoutDebounceTimer = null;

    function debouncedLayout() {
      if (!msnry) return;
      if (layoutDebounceTimer) clearTimeout(layoutDebounceTimer);
      layoutDebounceTimer = setTimeout(function () {
        msnry.layout();
      }, 100);
    }

    var resizeObserver = new ResizeObserver(function () {
      debouncedLayout();
    });

    function observeItems(elements) {
      elements.forEach(function (el) {
        resizeObserver.observe(el);
      });
    }

    function initMasonry() {
      if (typeof Masonry !== "undefined" && inner) {
        msnry = new Masonry(inner, {
          itemSelector: ".thought-container:not(.block-hidden)",
          columnWidth: ".grid-sizer",
          gutter: ".gutter-sizer",
          percentPosition: true,
          transitionDuration: 0,
        });

        observeItems(Array.from(inner.querySelectorAll(".thought-container")));
      }
    }

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
      if (!html) return [];
      var template = document.createElement("template");
      template.innerHTML = html;
      var newElements = Array.from(template.content.children);
      inner.appendChild(template.content);
      return newElements;
    }

    function showError(message) {
      if (initialLoader) {
        initialLoader.textContent = "";
        initialLoader.innerHTML =
          '<div class="initial-error">' +
          escapeHtml(message) +
          "<br><br>" +
          '<a href="' +
          channelUrl +
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
          var html = renderBlocksHtml(pageData.blocks);
          currentPage = pageData.meta.currentPage;
          totalPages = pageData.meta.totalPages || totalPages;

          if (html.trim()) {
            var newElements = appendHtml(html);
            if (typeof window.initializeThoughtEnhancements === "function") {
              window.initializeThoughtEnhancements();
            }

            var currentFilter = document.documentElement.getAttribute("data-active-filter") || "all";
            if (currentFilter !== "all") {
              newElements.forEach(function (el) {
                if (el.getAttribute("data-type") !== currentFilter) {
                  el.classList.add("block-hidden");
                }
              });
            }

            if (msnry) {
              observeItems(newElements);
              msnry.reloadItems();
              msnry.layout();
              imagesLoaded(inner, function () {
                msnry.layout();
              });
            }
          }

          if (!pageData.meta.hasMorePages || currentPage >= totalPages) {
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

    (async function () {
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

        if (initialLoader) {
          initialLoader.remove();
        }

        var firstHtml = renderBlocksHtml(firstPageData.blocks);
        if (firstHtml.trim()) {
          appendHtml(firstHtml);
        }

        if (typeof window.initializeThoughtEnhancements === "function") {
          window.initializeThoughtEnhancements();
        }

        initMasonry();
        window.msnry = msnry;

        if (msnry) {
          msnry.layout();
          imagesLoaded(inner, function () {
            msnry.layout();
          });
        }

        if (totalPages > 1) {
          contentArea.appendChild(sentinel);
          contentArea.appendChild(loader);

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
              rootMargin: "800px",
              threshold: 0,
            }
          );

          observer.observe(sentinel);

          setTimeout(function () {
            var rect = sentinel.getBoundingClientRect();
            if (rect.top < window.innerHeight + 800) {
              loadNextPage();
            }
          }, 500);

          setTimeout(function () {
            var rect = sentinel.getBoundingClientRect();
            if (rect.top < window.innerHeight + 800) {
              loadNextPage();
            }
          }, 1500);
        }

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
