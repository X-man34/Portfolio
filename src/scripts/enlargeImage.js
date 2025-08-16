function openEnlargeableImageModal(imageSrc) {
        const modal = document.getElementById('enlargeableImageModal');
        const modalImg = document.getElementById('enlargeableModalImage');
        modal.style.display = "flex"; // Show modal
        modalImg.src = imageSrc; // Set modal image source
        // document.body.classList.add('blur'); // Remove blur class from body
    }

// Close modal functionality
document.querySelector('.close').onclick = function() {
    document.getElementById('enlargeableImageModal').style.display = "none"; // Hide modal
    // document.body.classList.remove('blur'); // Remove blur class from body
}

// Close modal when clicking outside of the image
document.getElementById('enlargeableImageModal').onclick = function(event) {
    if (event.target === this) {
        this.style.display = "none"; // Hide modal
        // document.body.classList.remove('blur'); // Remove blur class from body
    }
}
