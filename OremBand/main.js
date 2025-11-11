// main.js - minimal interactivity: mobile nav toggle and dropdown
document.addEventListener('DOMContentLoaded', function () {
  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');
  const dropdown = document.querySelector('.dropdown');
  const dropdownLink = dropdown?.querySelector('.dropdown-toggle');

  navToggle.addEventListener('click', function () {
    const expanded = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!expanded));
    mainNav.classList.toggle('open');
  });

  // Toggle dropdown on mobile
  if (dropdownLink) {
    const dropdownMenu = dropdown.querySelector('.dropdown-menu');
    dropdownLink.addEventListener('click', function (e) {
      // Only toggle on mobile (when nav is in mobile mode)
      if (window.innerWidth <= 720) {
        e.preventDefault();
        const isOpen = dropdown.classList.contains('open');
        dropdown.classList.toggle('open');
        dropdownLink.setAttribute('aria-expanded', String(!isOpen));
        if (dropdownMenu) {
          dropdownMenu.hidden = isOpen;
        }
      }
    });
  }

  // Close mobile menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!mainNav.contains(e.target) && !navToggle.contains(e.target)) {
      mainNav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });

  // Hero card fold-out functionality
  const heroCards = document.querySelectorAll('.hero-card');
  const heroStack = document.querySelector('.hero-stack');
  let activeCard = null;

  heroCards.forEach((card) => {
    // Click to activate / expand stack
    card.addEventListener('click', function (e) {
      // Prevent the document click listener from immediately closing when clicking
      e.stopPropagation();

      const wasActive = card.classList.contains('active');

      // Clear active state on all cards
      heroCards.forEach((c) => c.classList.remove('active'));

      if (!wasActive) {
        // Set this card active and expand the stack
        card.classList.add('active');
        heroStack.classList.add('expanded');
        activeCard = card;
      } else {
        // Collapse
        heroStack.classList.remove('expanded');
        activeCard = null;
      }
    });

    // Maintain flip behavior for back/front content (optional)
    const front = card.querySelector('.card-front');
    const back = card.querySelector('.card-back');
    if (front && back) {
      // Double-click flips as alternate interaction for accessibility
      card.addEventListener('dblclick', function (ev) {
        ev.stopPropagation();
        card.classList.toggle('flipped');
      });
    }

    // Hover effect (optional)
    card.addEventListener('mouseenter', function () {
      if (!card.classList.contains('active') && window.innerWidth > 720) {
        card.style.transform += ' translateZ(40px)';
      }
    });

    card.addEventListener('mouseleave', function () {
      if (!card.classList.contains('active')) {
        card.style.transform = '';
      }
    });
  });

  // Close card when clicking outside the stack
  document.addEventListener('click', (e) => {
    if (activeCard && !activeCard.contains(e.target)) {
      activeCard.classList.remove('active');
      heroStack.classList.remove('expanded');
      activeCard = null;
    }
  });
});
