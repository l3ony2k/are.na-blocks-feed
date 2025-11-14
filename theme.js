(function () {
  "use strict";

  const THEMES = ["system", "light", "dark"];
  const STORAGE_KEY = "theme-preference";
  let activeFilter = "all";

  const setupTooltips = () => {
    const titleElements = document.querySelectorAll(".thought-title[data-tooltip-id]");

    titleElements.forEach((titleElement) => {
      if (titleElement.getAttribute("data-tooltip-bound") === "true") {
        return;
      }

      const tooltipId = titleElement.getAttribute("data-tooltip-id");
      if (!tooltipId) {
        return;
      }

      const tooltipContent = document.getElementById(tooltipId);
      if (!tooltipContent) {
        return;
      }

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
    const containers = document.querySelectorAll(".thought-container");
    containers.forEach((container) => {
      const blockType = container.getAttribute("data-type");
      if (activeFilter === "all" || blockType === activeFilter) {
        container.style.display = "block";
      } else {
        container.style.display = "none";
      }
    });
  };

  const initializeThemeToggle = () => {
    const themeToggleButton = document.getElementById("theme-toggle-button");
    const body = document.body;
    const htmlEl = document.documentElement;

    const applyTheme = (theme) => {
      if (themeToggleButton) {
        themeToggleButton.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
      }

      body.setAttribute("data-theme", theme);

      if (theme === "system") {
        htmlEl.classList.remove("theme-light", "theme-dark");
      } else if (theme === "light") {
        htmlEl.classList.add("theme-light");
        htmlEl.classList.remove("theme-dark");
      } else if (theme === "dark") {
        htmlEl.classList.add("theme-dark");
        htmlEl.classList.remove("theme-light");
      }
    };

    const savePreference = (theme) => {
      if (theme === "system") {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, theme);
      }
    };

    const savedTheme = localStorage.getItem(STORAGE_KEY);
    const initialTheme = savedTheme || "system";
    applyTheme(initialTheme);

    if (themeToggleButton) {
      themeToggleButton.addEventListener("click", () => {
        const currentTheme = body.getAttribute("data-theme") || "system";
        const currentIndex = THEMES.indexOf(currentTheme);
        const nextTheme = THEMES[(currentIndex + 1) % THEMES.length];

        applyTheme(nextTheme);
        savePreference(nextTheme);
      });
    }
  };

  const initializeFilters = () => {
    const filterButtons = document.querySelectorAll(".filter-button");

    const activeButton = document.querySelector(".filter-button.active");
    activeFilter = activeButton ? activeButton.getAttribute("data-filter") || "all" : "all";

    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        if (button.classList.contains("active")) {
          return;
        }

        filterButtons.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");

        activeFilter = button.getAttribute("data-filter") || "all";
        applyFilter();
      });
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
    initializeThemeToggle();
    initializeFilters();
    initializeModal();
    initializeThoughtEnhancements();
  });

  window.initializeThoughtEnhancements = initializeThoughtEnhancements;
})();
