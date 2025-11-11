function registerComponent() {
  Alpine.data('galleryApp', function() {
    return {
      // Image data - expand this with more images
      images: [
        {
          src: 'Images/2024OHSWindSymphony.jpg',
          alt: '2024 Wind Symphony group photo',
          title: 'Wind Symphony',
          description: '2024 Group Photo',
          loaded: false,
          visible: false
        },
        {
          src: 'Images/MarchingBandLogo.png',
          alt: 'Marching Band Logo',
          title: 'Marching Band',
          description: 'Band Logo',
          loaded: false,
          visible: false
        },
        {
          src: 'Images/BandLogo.png',
          alt: 'Orem Tiger Bands Logo',
          title: 'Orem Tiger Bands',
          description: 'Official Logo',
          loaded: false,
          visible: false
        },
        {
          src: 'Images/Winters.jpg',
          alt: 'Director Curtis Winters',
          title: 'Director',
          description: 'Curtis Winters',
          loaded: false,
          visible: false
        },
        {
          src: 'Images/2024OHSWindSymphony.jpg',
          alt: 'Wind Symphony performance',
          title: 'Wind Symphony',
          description: 'Performance Photo',
          loaded: false,
          visible: false
        },
        {
          src: 'Images/MarchingBandLogo.png',
          alt: 'Marching Band performance',
          title: 'Marching Band',
          description: 'Field Performance',
          loaded: false,
          visible: false
        },
        {
          src: 'Images/BandLogo.png',
          alt: 'Band logo display',
          title: 'Orem Tiger Bands',
          description: 'School Logo',
          loaded: false,
          visible: false
        },
        {
          src: 'Images/Winters.jpg',
          alt: 'Director portrait',
          title: 'Director',
          description: 'Curtis Winters Portrait',
          loaded: false,
          visible: false
        },
        {
          src: 'Images/2024OHSWindSymphony.jpg',
          alt: 'Concert performance',
          title: 'Concert',
          description: 'Live Performance',
          loaded: false,
          visible: false
        },
        {
          src: 'Images/MarchingBandLogo.png',
          alt: 'Marching formation',
          title: 'Formation',
          description: 'Marching Formation',
          loaded: false,
          visible: false
        },
        {
          src: 'Images/BandLogo.png',
          alt: 'Band emblem',
          title: 'Emblem',
          description: 'Official Emblem',
          loaded: false,
          visible: false
        },
        {
          src: 'Images/Winters.jpg',
          alt: 'Director conducting',
          title: 'Conducting',
          description: 'Director Conducting',
          loaded: false,
          visible: false
        }
      ],

      observer: null,

      // Modal state
      modalOpen: false,
      selectedImage: null,

      init() {
        // Setup Intersection Observer for lazy loading
        this.setupIntersectionObserver();
        
        // Check for already-loaded images
        this.$nextTick(() => {
          setTimeout(() => {
            this.checkLoadedImages();
          }, 100);
        });

        // Keyboard handler for ESC key
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && this.modalOpen) {
            this.closeModal();
          }
        });
      },

      setupIntersectionObserver() {
        const options = {
          root: null,
          rootMargin: '50px', // Start loading 50px before image enters viewport
          threshold: 0.01
        };

        this.observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const index = parseInt(entry.target.dataset.index);
              if (index !== undefined && !this.images[index].visible) {
                this.images[index].visible = true;
              }
            }
          });
        }, options);
      },

      observeImage(element, index) {
        if (this.observer && element) {
          element.dataset.index = index;
          this.observer.observe(element);
        }
      },

      unobserveImage(element) {
        if (this.observer && element) {
          this.observer.unobserve(element);
        }
      },

      // Load image with fade-in effect (similar to example)
      loadImage(index) {
        if (!this.images[index].loaded) {
          this.images[index].loaded = true;
        }
      },

      checkLoadedImages() {
        // Check for cached images that already loaded
        const imageElements = document.querySelectorAll('.gallery-grid-item img');
        imageElements.forEach((img, idx) => {
          if (img.complete && img.naturalHeight !== 0 && !this.images[idx].loaded) {
            this.loadImage(idx);
          }
        });
      },

      // Check if media is a video
      isVideo(src) {
        if (!src) return false;
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
        return videoExtensions.some(ext => src.toLowerCase().endsWith(ext));
      },

      // Open modal with selected image/video
      openModal(index) {
        this.selectedImage = this.images[index];
        this.modalOpen = true;
        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
      },

      // Close modal
      closeModal() {
        this.modalOpen = false;
        this.selectedImage = null;
        // Restore body scroll
        document.body.style.overflow = '';
      }
    };
  });
}

// Register component when Alpine is ready
document.addEventListener('alpine:init', registerComponent, false);
