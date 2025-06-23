document.addEventListener('DOMContentLoaded', () => {
    const themeToggleButton = document.getElementById('theme-toggle-button');
    const body = document.body;

    const themes = ['system', 'light', 'dark'];
    const storageKey = 'theme-preference';

    const applyTheme = (theme) => {
        body.setAttribute('data-theme', theme);
        themeToggleButton.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
    };

    const savePreference = (theme) => {
        if (theme === 'system') {
            localStorage.removeItem(storageKey);
        } else {
            localStorage.setItem(storageKey, theme);
        }
    };

    // Initialize theme on page load
    const savedTheme = localStorage.getItem(storageKey);
    const initialTheme = savedTheme || 'system';
    applyTheme(initialTheme);

    // Handle button click
    themeToggleButton.addEventListener('click', () => {
        const currentTheme = body.getAttribute('data-theme');
        const currentIndex = themes.indexOf(currentTheme);
        const nextIndex = (currentIndex + 1) % themes.length;
        const nextTheme = themes[nextIndex];

        applyTheme(nextTheme);
        savePreference(nextTheme);
    });

    // Handle tooltip functionality
    const setupTooltips = () => {
        const titleElements = document.querySelectorAll('.thought-title[data-tooltip-id]');
        
        titleElements.forEach(titleElement => {
            const tooltipId = titleElement.getAttribute('data-tooltip-id');
            const tooltipContent = document.getElementById(tooltipId);
            
            if (tooltipContent) {
                let hideTimeout = null;
                
                const showTooltip = () => {
                    // Clear any pending hide timeout
                    if (hideTimeout) {
                        clearTimeout(hideTimeout);
                        hideTimeout = null;
                    }
                    
                    // Get the position of the title element
                    const rect = titleElement.getBoundingClientRect();
                    
                    // Position tooltip above the title element
                    tooltipContent.style.display = 'block';
                    tooltipContent.style.left = rect.left + 'px';
                    tooltipContent.style.top = (rect.top - tooltipContent.offsetHeight - 10) + 'px';
                    
                    // Ensure tooltip doesn't go off-screen
                    const tooltipRect = tooltipContent.getBoundingClientRect();
                    if (tooltipRect.left < 0) {
                        tooltipContent.style.left = '10px';
                    }
                    if (tooltipRect.right > window.innerWidth) {
                        tooltipContent.style.left = (window.innerWidth - tooltipRect.width - 10) + 'px';
                    }
                    if (tooltipRect.top < 0) {
                        // If tooltip would go above viewport, show it below the title instead
                        tooltipContent.style.top = (rect.bottom + 10) + 'px';
                    }
                };
                
                const hideTooltip = () => {
                    hideTimeout = setTimeout(() => {
                        tooltipContent.style.display = 'none';
                        hideTimeout = null;
                    }, 100); // 100ms delay before hiding
                };
                
                const cancelHide = () => {
                    if (hideTimeout) {
                        clearTimeout(hideTimeout);
                        hideTimeout = null;
                    }
                };
                
                // Title element events
                titleElement.addEventListener('mouseenter', showTooltip);
                titleElement.addEventListener('mouseleave', hideTooltip);
                
                // Tooltip content events - prevent hiding when hovering over tooltip
                tooltipContent.addEventListener('mouseenter', cancelHide);
                tooltipContent.addEventListener('mouseleave', hideTooltip);
            }
        });
    };

    // Initialize tooltips
    setupTooltips();
    
    // Handle filter functionality
    const filterButtons = document.querySelectorAll('.filter-button');
    const thoughtContainers = document.querySelectorAll('.thought-container');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Set active state
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const filter = button.getAttribute('data-filter');

            thoughtContainers.forEach(container => {
                if (filter === 'all') {
                    container.style.display = 'block';
                } else {
                    if (container.getAttribute('data-type') === filter) {
                        container.style.display = 'block';
                    } else {
                        container.style.display = 'none';
                    }
                }
            });
        });
    });
    
    // Handle About Modal
    const aboutButton = document.getElementById('about-button');
    const aboutModal = document.getElementById('about-modal');
    const modalClose = document.querySelector('.modal-close');

    if (aboutButton && aboutModal && modalClose) {
        aboutButton.addEventListener('click', () => {
            aboutModal.style.display = 'flex';
        });

        const closeModal = () => {
            aboutModal.style.display = 'none';
        };

        modalClose.addEventListener('click', closeModal);

        aboutModal.addEventListener('click', (event) => {
            if (event.target === aboutModal) {
                closeModal();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && aboutModal.style.display === 'flex') {
                closeModal();
            }
        });
    }
}); 