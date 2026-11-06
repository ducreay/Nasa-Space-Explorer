// Get DOM objects
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');
const exploreButton = document.getElementById('button');
const viewMoreButton = document.getElementById('view-more');
const placeholder = document.querySelector('.placeholder');
const placeholderIcon = document.querySelector('.placeholder-icon');
const hookElement = document.getElementById('hook');
const sentenceElement = document.getElementById('sentence');
const gallery = document.getElementById('gallery');
const apodModal = document.getElementById('apod-modal');
const modalMedia = document.getElementById('modal-media');
const modalTitle = document.getElementById('modal-title');
const modalDate = document.getElementById('modal-date');
const modalExplanation = document.getElementById('modal-explanation');
const modalPermalink = document.getElementById('modal-permalink');
const modalCloseButton = document.getElementById('modal-close');
const randomSpaceFactsUrl = new URL('randomSpaceFacts.txt', document.currentScript.src);
const spaceEmojis = ['🔭', '🛰️', '🚀', '🛸', '🌕'];
let requestedEndDate = '';
let nextBatchStartDate = '';
let isSingleDateRequest = false;
let isLoadingImages = false;

// Set up default behavior for date inputs
setupDateInputs(startInput, endInput);

// Listen for when buttons are clicked
exploreButton.addEventListener('click', updateGallery);
viewMoreButton.addEventListener('click', loadNextBatch);

// Majority of the work (Tracks dates/batches and updates the gallery with new cards)
// --------------------------------------------------------------------------------
// Create cards for the selected date range
async function updateGallery(){
    // Don't overlap image loading
    if (isLoadingImages) return;

    // Keep copies of the user's dates so the input values are never changed
    nextBatchStartDate = startInput.value;
    requestedEndDate = endInput.value;
    isSingleDateRequest = nextBatchStartDate === requestedEndDate;

    // Get and display data for the selected dates
    gallery.querySelectorAll('.gallery-item').forEach((card) => card.remove());
    viewMoreButton.hidden = true;
    await loadNextBatch();
}

// Load the next range of up to 25 dates and append its cards
async function loadNextBatch(){
    // Assert valid function conditions
    if (isLoadingImages || !nextBatchStartDate || nextBatchStartDate > requestedEndDate) return;

    // Update state variables
    isLoadingImages = true;
    viewMoreButton.hidden = true;
    gallery.append(placeholder);

    // Test for any errors that occur in the next few steps
    try {
        // Display a random space fact using the placeholder
        await updatePlaceholder();

        // Calculate a 25 day batch of the user's date range
        const batchEndDate = getEarlierDate(addDays(nextBatchStartDate, 24), requestedEndDate);
        const startDateCode = toApodDate(nextBatchStartDate);
        const endDateCode = toApodDate(batchEndDate);

        // Access one of two URLs based on whether the data range is one day or multiple
        const apodUrl = isSingleDateRequest
            ? `https://science.nasa.gov/wp-json/wp/v2/apod-basic/${startDateCode}`
            : `https://science.nasa.gov/wp-json/wp/v2/apod-basic?date_from=${startDateCode}&date_to=${endDateCode}`;

        // Wait for the response
        const response = await fetch(apodUrl);
        if (!response.ok) {
            throw new Error(`Could not load the space images: ${response.status}`);
        }

        // Validate a successful response and data within the response
        const apodResponse = await response.json();
        const apodItems = Array.isArray(apodResponse) ? apodResponse : [apodResponse];
        const itemsInBatch = apodItems
            .filter((item) => item.date >= nextBatchStartDate && item.date <= batchEndDate)
            .sort((firstItem, secondItem) => firstItem.date.localeCompare(secondItem.date));
        if (itemsInBatch.length === 0) {
            throw new Error('No space images were found for this date range.');
        }

        // Validate, split, and display the data for each card in the batch
        itemsInBatch.forEach(validateApodData);
        hidePlaceholder();
        itemsInBatch.forEach(showImageCard);

        // Calculate the next batch and if the "View More" button needs to be displayed
        nextBatchStartDate = addDays(batchEndDate, 1);
        viewMoreButton.hidden = nextBatchStartDate > requestedEndDate;
    } catch (error){
        // Error occured while fetching media
        sentenceElement.textContent = `Could not load the next images: ${error.message}`;
        console.error(error);
        viewMoreButton.hidden = nextBatchStartDate > requestedEndDate ||
            gallery.querySelector('.gallery-item') === null;
    } finally {
        // Update state variables
        isLoadingImages = false;
        gallery.append(placeholder);
    }
}
// --------------------------------------------------------------------------------

// Date Editing
// --------------------------------------------------------------------------------
// Returns which of two dates is earlier
function getEarlierDate(firstDate, secondDate){ return firstDate < secondDate ? firstDate : secondDate; }

// Calculates the date "days" day(s) away
function addDays(date, days){
    const [year, month, day] = date.split('-').map(Number);
    const nextDate = new Date(Date.UTC(year, month - 1, day + days));
    return nextDate.toISOString().slice(0, 10);
}

// Converts a YYYY-MM-DD date to YYMMDD, used for APOD URLs
function toApodDate(date){ return date.slice(2).replaceAll('-', ''); }

// Format an APOD date as Month Day with an ordinal suffix, followed by the year
function formatApodDate(date){
    const [year, month, day] = date.split('-').map(Number);
    const monthName = new Date(year, month - 1, day).toLocaleString('en-US', { month: 'long' });
    const daySuffix = day % 100 >= 11 && day % 100 <= 13
        ? 'th'
        : ({ 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] || 'th');
    return `${monthName} ${day}${daySuffix}, ${year}`;
}
// --------------------------------------------------------------------------------

// Card Creation and Display
// --------------------------------------------------------------------------------
// Add one APOD image card to the gallery
function showImageCard(apodData){
    // Create the card's structure
    const { date, title } = apodData;
    const card = document.createElement('article');
    card.className = 'gallery-item';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `View details for ${title}`);

    // Create the card's media
    const media = createApodMedia(apodData);

    // Create the card's title
    const cardTitle = document.createElement('h2');
    cardTitle.textContent = title;

    // Create the card's date
    const cardDate = document.createElement('p');
    cardDate.textContent = formatApodDate(date);

    // Add the non-interactive card elements
    card.append(media, cardTitle, cardDate);

    // Add interactive elements to the card
    card.addEventListener('click', (event) => {
        if (event.target instanceof Element && event.target.closest('video')) return;
        showApodModal(apodData);
    });
    card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            showApodModal(apodData);
        }
    });

    // Add the card to the gallery
    gallery.append(card);
}

// Check each response has the details needed to display its card
function validateApodData(apodData){
    // Confirm date, title, and media_type are present
    if (!apodData.date || !apodData.title || !apodData.media_type)
        throw new Error('An APOD response is missing the date, title, or media type.');

    // Confirm images have an associated URL
    if (apodData.media_type === 'image' && !apodData.hdurl)
        throw new Error('An APOD image response is missing its image URL.');

    // Confirm that media_type is a known type of media
    if (apodData.media_type !== 'image' &&
        apodData.media_type !== 'video' &&
        apodData.media_type !== 'iframe'){
        throw new Error(`Unsupported APOD media type: ${apodData.media_type}`);
    }
}

// Create the correct embedded media element for an APOD
function createApodMedia({ media_type, title, hdurl, basic_html }){
    // Create needed variable(s)
    let media;

    // Creete media based on media_type
    if (media_type === 'image'){
        // Image
        media = document.createElement('img');
        media.src = getSafeMediaUrl(hdurl);
        media.alt = title;
    } else if (media_type === 'video' || media_type === 'iframe'){
        // Video
        const apodHtml = new DOMParser().parseFromString(basic_html || '', 'text/html');
        const embeddedMedia = apodHtml.querySelector('iframe, video');

        // Confirm the media can be embedded
        if (!embeddedMedia)
            throw new Error(`The APOD ${media_type} does not contain embeddable media.`);

        // Check if the exact that was an iframe or video
        if (embeddedMedia.tagName === 'IFRAME'){
            // Iframe
            media = document.createElement('iframe');
            media.src = getSafeMediaUrl(embeddedMedia.getAttribute('src'));
            media.title = title;
            media.allowFullscreen = true;
            media.loading = 'lazy';
        } else {
            // Video
            media = document.createElement('video');
            media.controls = true;
            media.setAttribute('aria-label', title);

            const videoSource = embeddedMedia.getAttribute('src');
            if (videoSource) media.src = getSafeMediaUrl(videoSource);

            embeddedMedia.querySelectorAll('source').forEach((source) => {
                const safeSource = document.createElement('source');
                safeSource.src = getSafeMediaUrl(source.getAttribute('src'));
                safeSource.type = source.getAttribute('type') || '';
                media.append(safeSource);
            });

            // Confirm there is a video to be played
            if (!videoSource && media.children.length === 0)
                throw new Error('The APOD video does not contain a playable source.');
        }
    } else {
        // Unknown media_type
        throw new Error(`Unsupported APOD media type: ${media_type}`);
    }

    // Return the image or embedded element
    media.className = 'apod-media';
    return media;
}

// Only allow web URLs for media embedded in the page
function getSafeMediaUrl(url){
    // Confirm that there is a media URL
    if (!url)
        throw new Error('The APOD media URL is missing.');

    // Confirm that the URL has a secure connection
    const mediaUrl = new URL(url, document.baseURI);
    if (mediaUrl.protocol !== 'http:' && mediaUrl.protocol !== 'https:')
        throw new Error('The APOD media URL must use HTTP or HTTPS.');

    // Return the confirmed safe URL
    return mediaUrl.href;
}
// --------------------------------------------------------------------------------

// Modal Functionality
// --------------------------------------------------------------------------------
// Fill and open the modal with details from the selected APOD
function showApodModal(apodData){
    modalMedia.replaceChildren(createApodMedia(apodData));
    const { date, title, explanation, permalink } = apodData;
    modalTitle.textContent = title;
    modalDate.textContent = formatApodDate(date);
    modalExplanation.textContent = new DOMParser()
        .parseFromString(explanation || '', 'text/html')
        .body.textContent;
    modalPermalink.href = permalink;
    apodModal.hidden = false;
}

// Close the modal when the user clicks its backdrop
apodModal.addEventListener('click', (event) => {
    if (event.target === apodModal) apodModal.hidden = true;
});

// Close the model when the user clicks its dedicated "X" button
modalCloseButton.addEventListener('click', () => {
    apodModal.hidden = true;
});
// --------------------------------------------------------------------------------

// Loading Fun Facts
// --------------------------------------------------------------------------------
// Show a random emoji and space fact while the images are loading
async function updatePlaceholder(){
    // Unhide the placeholder
    placeholder.hidden = false;

    // Choose one of 5 random icons to show above the random space fact
    placeholderIcon.textContent = spaceEmojis[Math.floor(Math.random() * spaceEmojis.length)];

    // Get the text document with the random space facts
    const response = await fetch(randomSpaceFactsUrl);
    if (!response.ok)
        throw new Error(`Could not load space facts: ${response.status}`);

    // Parse the document to identify the index, hook, and sentence of the chosen fact
    const facts = (await response.text())
        .split(/\r?\n/)
        .filter((line) => line.trim() !== '');
    const [index, hook, sentence] = facts[Math.floor(Math.random() * facts.length)]
        .split('\\,')
        .map((part) => part.trim());
    if (!index || !hook || !sentence)
        throw new Error('The selected space fact is not formatted correctly.');

    // Update the html elements with the random fact
    hookElement.textContent = hook;
    hookElement.style.textAlign = 'center';
    hookElement.style.fontWeight = 'bold';
    sentenceElement.textContent = sentence;
    sentenceElement.style.textAlign = 'center';
    sentenceElement.style.fontWeight = 'normal';
}

// Hide the placeholder after the images have been received
function hidePlaceholder(){ placeholder.hidden = true; }
// --------------------------------------------------------------------------------