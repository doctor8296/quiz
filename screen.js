function updateAspectRatio() {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const gameWidth = 1024;
    const gameHeight = 720;
    const containerAspectRatio = gameWidth/gameHeight;
    if (windowWidth / windowHeight > containerAspectRatio) {
        document.body.style.zoom = windowHeight/gameHeight;
    } else {
        document.body.style.zoom = windowWidth/gameWidth;
    }
    // const container = document.querySelector('.container'); 
    // container.style.position = "fixed"
    // container.style.top = "50%";
    // container.style.left = "50%";
    // container.style.transform = "translate(-10%, -10%)"; 
}
window.addEventListener("resize", updateAspectRatio);
updateAspectRatio();