// Render time (`ago` in millis) in relative form if it's closer to `now`.
let displayTime = (ago: number, now: number | null = null): string => {
    const msPerMinute = 60 * 1000;
    const msPerHour = msPerMinute * 60;
    const msPerDay = msPerHour * 24;
    const msPerWeek = msPerDay * 7;
    var elapsed = (now || Date.now()) - ago;
    if (elapsed < msPerMinute * 2) {
        return "just now";
    } else if (elapsed < msPerHour * 2) {
        return Math.round(elapsed / msPerMinute) + ' minutes ago';
    } else if (elapsed < msPerDay * 2) {
        return Math.round(elapsed / msPerHour) + ' hours ago';
    } else if (elapsed < msPerWeek * 2) {
        return Math.round(elapsed / msPerDay) + ' days ago';
    } else {
        return new Date(ago).toLocaleString();
    }
};

export { displayTime };