(function () {
  "use strict";

  const DEFAULT_LOADER_TEXT = "Loading more...";

  function parseConfig() {
    const configElement = document.getElementById("blocks-config");
    if (!configElement) {
      return null;
    }

    const raw = (configElement.textContent || "").trim();
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      console.error("Failed to parse blocks config", error);
      return null;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const contentArea = document.getElementById("content-area");
    const inner = contentArea ? contentArea.querySelector(".content-inner") : null;

    if (!inner) {
      return;
    }

    if (typeof window.initializeThoughtEnhancements === "function") {
      window.initializeThoughtEnhancements();
    }

    const config = parseConfig();
    if (!config) {
      return;
    }

    const totalPages = Number(config.totalPages) || 1;
    let currentPage = Number(config.initialPage) || 1;

    const shouldPaginate = totalPages > currentPage;

    let observer = null;
    let loadingPromise = null;

    const loader = document.createElement("div");
    loader.id = "infinite-loader";
    loader.textContent = DEFAULT_LOADER_TEXT;

    const sentinel = document.createElement("div");
    sentinel.id = "pagination-sentinel";
    sentinel.setAttribute("aria-hidden", "true");

    if (shouldPaginate) {
      inner.appendChild(loader);
      inner.appendChild(sentinel);
    }

    const setLoaderVisible = (visible) => {
      if (!shouldPaginate) {
        return;
      }

      if (visible) {
        loader.textContent = DEFAULT_LOADER_TEXT;
        loader.classList.remove("error");
        loader.classList.add("active");
      } else if (!loader.classList.contains("error")) {
        loader.classList.remove("active");
      }
    };

    const showLoaderError = (message) => {
      if (!shouldPaginate) {
        return;
      }
      loader.textContent = message;
      loader.classList.add("error", "active");
    };

    const appendHtml = (html) => {
      if (!html || !shouldPaginate) {
        return;
      }
      const template = document.createElement("template");
      template.innerHTML = html;
      inner.insertBefore(template.content, sentinel);
    };

    const fetchPageHtml = async (page) => {
      const response = await fetch(`/api/blocks?page=${page}`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch page ${page}: ${response.status}`);
      }

      const data = await response.json();
      return typeof data.html === "string" ? data.html : "";
    };

    const loadNextPage = () => {
      if (!shouldPaginate) {
        return Promise.resolve(false);
      }

      if (loadingPromise) {
        return loadingPromise;
      }

      if (currentPage >= totalPages) {
        observer?.disconnect();
        return Promise.resolve(false);
      }

      const nextPage = currentPage + 1;

      loadingPromise = (async () => {
        setLoaderVisible(true);

        try {
          const html = await fetchPageHtml(nextPage);
          currentPage = nextPage;

          if (html.trim()) {
            appendHtml(html);
            if (typeof window.initializeThoughtEnhancements === "function") {
              window.initializeThoughtEnhancements();
            }
          }

          if (currentPage >= totalPages) {
            observer?.disconnect();
          }

          return true;
        } catch (error) {
          console.error("Unable to load additional Are.na blocks", error);
          showLoaderError("Unable to load more right now.");
          observer?.disconnect();
          return false;
        } finally {
          if (!loader.classList.contains("error")) {
            setLoaderVisible(false);
          }
          loadingPromise = null;
        }
      })();

      return loadingPromise;
    };

    if (shouldPaginate) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
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

    let targetBlockId = window.location.hash ? window.location.hash.slice(1) : "";
    let targetResolved = !targetBlockId;

    const ensureTargetBlock = async () => {
      if (!targetBlockId || targetResolved) {
        return;
      }

      let block = document.getElementById(targetBlockId);

      while (!block && currentPage < totalPages) {
        const loaded = await loadNextPage();
        if (!loaded) {
          break;
        }
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

    window.addEventListener("hashchange", () => {
      targetBlockId = window.location.hash ? window.location.hash.slice(1) : "";
      targetResolved = !targetBlockId;
      if (targetBlockId) {
        ensureTargetBlock();
      }
    });
  });
})();
