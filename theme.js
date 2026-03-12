(function () {
  "use strict";

  const THEMES = ["system", "light", "dark"];
  const LAYOUTS = ["feed", "wide", "xwide"];
  const THEME_STORAGE_KEY = "theme-preference";
  const LAYOUT_STORAGE_KEY = "layout-preference";

  let activeFilter = "all";
  let activeTheme = "system";
  let activeLayout = "feed";

  const setupTooltips = () => {
    const titleElements = document.querySelectorAll(".thought-title[data-tooltip-id]");

    titleElements.forEach((titleElement) => {
      if (titleElement.getAttribute("data-tooltip-bound") === "true") {
        return;
      }

      const tooltipId = titleElement.getAttribute("data-tooltip-id");
      if (!tooltipId) return;

      const tooltipContent = document.getElementById(tooltipId);
      if (!tooltipContent) return;

      titleElement.setAttribute("data-tooltip-bound", "true");

      let hideTimeout = null;

      const showTooltip = () => {
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }

        tooltipContent.style.display = "block";

        const rect = titleElement.getBoundingClientRect();
        tooltipContent.style.left = `${rect.left}px`;
        tooltipContent.style.top = `${rect.top - tooltipContent.offsetHeight - 10}px`;

        const tooltipRect = tooltipContent.getBoundingClientRect();
        if (tooltipRect.left < 0) {
          tooltipContent.style.left = "10px";
        }
        if (tooltipRect.right > window.innerWidth) {
          tooltipContent.style.left = `${window.innerWidth - tooltipRect.width - 10}px`;
        }
        if (tooltipRect.top < 0) {
          tooltipContent.style.top = `${rect.bottom + 10}px`;
        }
      };

      const hideTooltip = () => {
        hideTimeout = window.setTimeout(() => {
          tooltipContent.style.display = "none";
          hideTimeout = null;
        }, 100);
      };

      const cancelHide = () => {
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
  };

  const applyFilter = () => {
    // Rely completely on robust CSS selectors for filtering dynamically loaded blocks
    document.documentElement.setAttribute('data-active-filter', activeFilter);

    // Update active state in UI
    const filterToggle = document.getElementById('filter-toggle');
    document.querySelectorAll('[data-filter]').forEach(btn => {
      if (btn.getAttribute('data-filter') === activeFilter) {
        btn.classList.add('active');
        if (filterToggle) filterToggle.textContent = `Filter: ${btn.textContent}`;
      } else {
        btn.classList.remove('active');
      }
    });

    document.querySelectorAll('.thought-container').forEach(el => {
      if (activeFilter === 'all' || el.getAttribute('data-type') === activeFilter) {
        el.classList.remove('block-hidden');
      } else {
        el.classList.add('block-hidden');
      }
    });

    // Update masonry blocks and layout
    if (window.msnry) {
      // Tell masonry to ignore hidden items
      window.msnry.options.itemSelector = '.thought-container:not(.block-hidden)';
      window.msnry.reloadItems();
      window.msnry.layout();
    }
  };

  const applySettings = (theme, layout) => {
    const body = document.body;
    const htmlEl = document.documentElement;

    activeTheme = theme || "system";
    activeLayout = layout || "feed";

    // Theme Application
    body.setAttribute("data-theme", activeTheme);

    htmlEl.classList.remove("theme-light", "theme-dark");
    if (activeTheme === "light") {
      htmlEl.classList.add("theme-light");
    } else if (activeTheme === "dark") {
      htmlEl.classList.add("theme-dark");
    }

    // Layout Application
    htmlEl.classList.remove("layout-feed", "layout-wide", "layout-xwide");
    htmlEl.classList.add(`layout-${activeLayout}`);

    // Update UI Activations
    document.querySelectorAll('[data-theme]').forEach(btn => {
      if (btn.getAttribute('data-theme') === activeTheme) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    document.querySelectorAll('[data-layout]').forEach(btn => {
      if (btn.getAttribute('data-layout') === activeLayout) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Save preferences
    if (activeTheme === "system") {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, activeTheme);
    }

    if (activeLayout === "feed") {
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
    } else {
      localStorage.setItem(LAYOUT_STORAGE_KEY, activeLayout);
    }

    setTimeout(() => {
      if (typeof window.syncThoughtLayout === "function") {
        window.syncThoughtLayout();
      }
      applyFilter();
    }, 350); // wait for CSS transitions
  };

  const initializeDropdowns = () => {
    const dropdowns = document.querySelectorAll(".dropdown");
    const toggles = document.querySelectorAll(".footer-button");

    // Close all open dropdowns
    const closeAll = () => {
      document.querySelectorAll(".dropdown-menu.open").forEach(menu => {
        menu.classList.remove("open");
        const toggle = menu.parentElement.querySelector('.footer-button');
        if (toggle) toggle.classList.remove("open");
      });
    };

    // Toggle click handlers
    toggles.forEach(toggle => {
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const menu = toggle.nextElementSibling;
        const isOpen = menu.classList.contains("open");

        closeAll();

        if (!isOpen) {
          menu.classList.add("open");
          toggle.classList.add("open");
        }
      });
    });

    // Item click handlers
    document.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener("click", (e) => {
        // Filter actions
        const filterVal = item.getAttribute('data-filter');
        if (filterVal) {
          activeFilter = filterVal;
          applyFilter();
        }

        // Theme and Layout Actions
        const themeVal = item.getAttribute('data-theme');
        if (themeVal) {
          applySettings(themeVal, activeLayout);
        }

        const layoutVal = item.getAttribute('data-layout');
        if (layoutVal) {
          applySettings(activeTheme, layoutVal);
        }

        closeAll();
      });
    });

    // Outer click to close
    document.addEventListener("click", () => closeAll());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAll();
    });
  };

  const initializeModal = () => {
    const aboutButton = document.getElementById("about-button");
    const aboutModal = document.getElementById("about-modal");
    const modalClose = document.querySelector(".modal-close");

    if (!aboutButton || !aboutModal || !modalClose) {
      return;
    }

    const closeModal = () => {
      aboutModal.style.display = "none";
    };

    aboutButton.addEventListener("click", () => {
      aboutModal.style.display = "flex";
    });

    modalClose.addEventListener("click", closeModal);

    aboutModal.addEventListener("click", (event) => {
      if (event.target === aboutModal) {
        closeModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && aboutModal.style.display === "flex") {
        closeModal();
      }
    });
  };

  const initializeThoughtEnhancements = () => {
    setupTooltips();
    applyFilter();
  };

  document.addEventListener("DOMContentLoaded", () => {
    const initialTheme = localStorage.getItem(THEME_STORAGE_KEY) || "system";
    const initialLayout = localStorage.getItem(LAYOUT_STORAGE_KEY) || "feed";
    applySettings(initialTheme, initialLayout);

    initializeDropdowns();
    initializeModal();
    initializeThoughtEnhancements();
  });

  window.initializeThoughtEnhancements = initializeThoughtEnhancements;
})();
