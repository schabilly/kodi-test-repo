const POV = 'plugin.video.pov';
const TMDB_KEY = 'd848316a33e79095beb945a2bd2d53b1';
const grid = document.getElementById('grid');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const breadcrumb = document.getElementById('breadcrumb');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const modal = document.getElementById('modal');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalPanel = document.getElementById('modalPanel');
const playerBar = document.getElementById('playerBar');
const playerThumb = document.getElementById('playerThumb');
const playerTitle = document.getElementById('playerTitle');
const playerProgressBar = document.getElementById('playerProgressBar');
const playerPlayPause = document.getElementById('playerPlayPause');
const playerStop = document.getElementById('playerStop');
const videoModal = document.getElementById('videoModal');
const videoModalBackdrop = document.getElementById('videoModalBackdrop');
const videoModalClose = document.getElementById('videoModalClose');
const videoPlayer = document.getElementById('videoPlayer');

let navStack = [];
let playerPollInterval = null;
const preloadedData = {};
const nextEpisodesPath = 'plugin://plugin.video.pov/?name=32483&iconImage=next_episodes.png&mode=build_next_episode';

async function rpc(method, params) {
    const res = await fetch('/jsonrpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.result;
}

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).catch(() => {});
    } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try { document.execCommand('copy'); } catch {}
        document.body.removeChild(ta);
    }
}

function showLoading() {
    grid.innerHTML = '';
    loading.classList.remove('hidden');
    error.classList.add('hidden');
}

function showError(msg) {
    loading.classList.add('hidden');
    error.textContent = msg;
    error.classList.remove('hidden');
}

function renderBreadcrumb() {
    breadcrumb.innerHTML = '';
    if (navStack.length > 1) {
        const back = document.createElement('button');
        back.textContent = '← Back';
        back.onclick = () => {
            navStack.pop();
            const prev = navStack[navStack.length - 1];
            loadPath(prev.path, prev.label, false);
        };
        breadcrumb.appendChild(back);
    }
    const label = navStack.length > 0 ? navStack[navStack.length - 1].label : '';
    if (label) {
        const span = document.createElement('span');
        span.textContent = label;
        breadcrumb.appendChild(span);
    }
}

function thumbUrl(url) {
    if (!url) return null;
    if (url.startsWith('image://')) {
        return '/image/' + encodeURIComponent(url);
    }
    return url;
}

function tmdbImage(path, size = 'w342') {
    return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

function extractTmdbId(url) {
    const m = url.match(/tmdb_id=(\d+)/);
    return m ? m[1] : null;
}

function extractMediaType(url, itemType) {
    if (url.includes('mediatype=movie')) return 'movie';
    if (url.includes('mediatype=episode')) return 'tvshow';
    if (itemType === 'tvshow') return 'tvshow';
    return null;
}

async function fetchTmdb(tmdbId, mediaType) {
    if (!tmdbId || !mediaType) return null;
    const type = (mediaType === 'tv' || mediaType === 'tvshow') ? 'tv' : 'movie';
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}&append_to_response=credits,videos`);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

async function fetchSimilar(tmdbId, mediaType) {
    if (!tmdbId || !mediaType) return [];
    const type = (mediaType === 'tv' || mediaType === 'tvshow') ? 'tv' : 'movie';
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/similar?api_key=${TMDB_KEY}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.results || [];
    } catch {
        return [];
    }
}

function findTrailer(tmdbData) {
    const videos = tmdbData?.videos?.results || [];
    const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube')
        || videos.find(v => v.site === 'YouTube');
    return trailer ? trailer.key : null;
}

function closeModal() {
    modal.classList.add('hidden');
    modalPanel.innerHTML = '';
}

modalBackdrop.onclick = closeModal;
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function buildCastHtml(cast) {
    if (!cast || cast.length === 0) return '';
    const items = cast.slice(0, 8).map(c => `
        <div class="cast-item" title="${c.name} as ${c.character || ''}">
            <div class="cast-photo">
                ${c.profile_path
                    ? `<img src="${tmdbImage(c.profile_path, 'w185')}" alt="${c.name}" loading="lazy">`
                    : `<span>${c.name.slice(0, 1)}</span>`}
            </div>
            <div class="cast-name">${c.name}</div>
            <div class="cast-role">${c.character || ''}</div>
        </div>
    `).join('');
    return `<div class="cast-row">${items}</div>`;
}

function buildSimilarHtml(similar, mediaType) {
    if (!similar || similar.length === 0) return '<p style="color:#888;font-size:0.85rem;">No similar items found.</p>';
    const items = similar.slice(0, 8).map(s => {
        const year = (s.first_air_date || s.release_date || '').slice(0, 4);
        const title = s.name || s.title;
        const isTv = mediaType === 'tv' || mediaType === 'tvshow';
        return `
            <div class="similar-item"
                data-title="${title.replace(/"/g, '&quot;')}"
                data-tmdb-id="${s.id}"
                data-media-type="${isTv ? 'tvshow' : 'movie'}"
                data-year="${year}"
                data-poster="${s.poster_path || ''}"
                data-overview="${(s.overview || '').replace(/"/g, '&quot;')}">
                <div class="similar-poster">
                    ${s.poster_path
                        ? `<img src="${tmdbImage(s.poster_path, 'w185')}" alt="${title}" loading="lazy">`
                        : `<span>${title.slice(0, 2).toUpperCase()}</span>`}
                </div>
                <div class="similar-title">${title}</div>
                ${year ? `<div class="similar-year">${year}</div>` : ''}
            </div>
        `;
    }).join('');
    return `<div class="similar-grid">${items}</div>`;
}

async function showDetails(item) {
    const tmdbId = extractTmdbId(item.file);
    const mediaType = extractMediaType(item.file, item.type);
    const tmdbData = await fetchTmdb(tmdbId, mediaType);

    const poster = thumbUrl(item.thumbnail || item.art?.poster || item.art?.icon || item.art?.fanart);
    const backdrop = tmdbData?.backdrop_path
        ? `https://image.tmdb.org/t/p/original${tmdbData.backdrop_path}`
        : null;
    const title = item.label.replace(/\[\/?COLOR[^\]]*\]/gi, '');
    const plot = tmdbData?.overview || item.plot || '';
    const year = tmdbData?.first_air_date?.slice(0, 4)
        || tmdbData?.release_date?.slice(0, 4)
        || (item.year > 0 ? item.year : '');
    const rating = tmdbData?.vote_average ? tmdbData.vote_average.toFixed(1) : '';
    const runtime = tmdbData?.runtime || tmdbData?.episode_run_time?.[0] || '';
    const genres = (tmdbData?.genres || []).map(g => g.name);
    const cast = tmdbData?.credits?.cast || [];
    const trailerKey = findTrailer(tmdbData);

    let actions = '';
    if (item.filetype === 'directory') {
        if (item.type === 'tvshow') {
            actions += `<button class="btn-primary" id="btnSeasons">View Seasons</button>`;
        } else {
            actions += `<button class="btn-primary" id="btnOpen">Open</button>`;
        }
    } else {
        actions += `<button class="btn-primary" id="btnPlay">▶ Play on Shield</button>`;
        actions += `<button class="btn-secondary" id="btnStream">Get Stream URL</button>`;
    }
    if (trailerKey) {
        actions += `<a class="btn-link" href="https://www.youtube.com/watch?v=${trailerKey}" target="_blank" rel="noopener">▶ Trailer</a>`;
    }


    modalPanel.innerHTML = `
        <button class="modal-close" id="btnClose">&times;</button>
        <div class="modal-body">
            <div class="modal-poster">
                ${poster ? `<img src="${poster}" alt="${title}" onerror="this.style.display='none';this.parentElement.textContent='${title.slice(0,2)}'">` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;">${title.slice(0,2)}</div>`}
            </div>
            <div class="modal-info">
                <div class="modal-title">${title}</div>
                <div class="modal-meta">
                    ${year ? `<span>${year}</span>` : ''}
                    ${rating ? `<span class="rating">★ ${rating}</span>` : ''}
                    ${runtime ? `<span>${runtime} min</span>` : ''}
                    ${item.type ? `<span class="badge">${item.type}</span>` : ''}
                    ${item.season > 0 ? `<span>S${item.season}E${item.episode}</span>` : ''}
                </div>
                ${genres.length ? `<div class="modal-genres">${genres.map(g => `<span class="genre">${g}</span>`).join('')}</div>` : ''}
                ${plot ? `<div class="modal-plot">${plot}</div>` : ''}
                <div class="modal-actions">
                    ${actions}
                </div>
            </div>
        </div>
        ${cast.length ? `<div class="modal-section"><h3>Cast</h3>${buildCastHtml(cast)}</div>` : ''}
        <div class="modal-section">
            <h3>Similar</h3>
            <div id="similarContainer">
                <button class="btn-secondary" id="btnSimilar">Show Similar ${mediaType === 'tvshow' ? 'Shows' : 'Movies'}</button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');

    document.getElementById('btnClose').onclick = closeModal;

    const btnPlay = document.getElementById('btnPlay');
    if (btnPlay) btnPlay.onclick = () => { play(item.file); closeModal(); };

    const btnOpen = document.getElementById('btnOpen');
    if (btnOpen) btnOpen.onclick = () => { loadPath(item.file, item.label); closeModal(); };

    const btnSeasons = document.getElementById('btnSeasons');
    if (btnSeasons) {
        let seasonPath = item.file;
        if (seasonPath.includes('mode=build_episode_list') && seasonPath.includes('season=all')) {
            seasonPath = seasonPath.replace('mode=build_episode_list', 'mode=build_season_list').replace(/&season=all/, '');
        }
        btnSeasons.onclick = () => { loadPath(seasonPath, item.label); closeModal(); };
    }

    const btnStream = document.getElementById('btnStream');
    if (btnStream) {
        btnStream.onclick = async () => {
            const originalText = btnStream.textContent;
            btnStream.textContent = 'Resolving...';
            btnStream.disabled = true;
            try {
                const url = await getStreamUrl(item.file);
                const wrapper = document.createElement('div');
                wrapper.className = 'stream-url-box';
                wrapper.innerHTML = `
                    <input type="text" class="stream-url-input" value="${url.replace(/"/g, '&quot;')}" readonly>
                    <button class="btn-primary" id="btnPlayBrowser">▶ Play in Browser</button>
                    <button class="btn-secondary" id="btnCopyUrl">Copy</button>
                `;
                btnStream.replaceWith(wrapper);
                document.getElementById('btnPlayBrowser').onclick = () => openVideoPlayer(url);
                document.getElementById('btnCopyUrl').onclick = () => {
                    copyToClipboard(url);
                    const input = wrapper.querySelector('.stream-url-input');
                    input.select();
                    const copyBtn = document.getElementById('btnCopyUrl');
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
                };
            } catch (err) {
                btnStream.textContent = 'Failed — check Auto-Play in POV';
                btnStream.disabled = false;
                setTimeout(() => { btnStream.textContent = originalText; }, 3000);
            }
        };
    }

    const btnSimilar = document.getElementById('btnSimilar');
    if (btnSimilar) {
        btnSimilar.onclick = async () => {
            btnSimilar.textContent = 'Loading...';
            btnSimilar.disabled = true;
            const similar = await fetchSimilar(tmdbId, mediaType);
            const container = document.getElementById('similarContainer');
            container.innerHTML = buildSimilarHtml(similar, mediaType);
            container.querySelectorAll('.similar-item').forEach(el => {
                el.onclick = () => {
                    const synthetic = {
                        file: `plugin://${POV}/?mode=build_${el.dataset.mediaType === 'tvshow' ? 'tvshow' : 'movie'}_list&action=tmdb_${el.dataset.mediaType === 'tvshow' ? 'tv' : 'movies'}_search&query=${encodeURIComponent(el.dataset.title)}&tmdb_id=${el.dataset.tmdbId}`,
                        type: el.dataset.mediaType,
                        filetype: 'directory',
                        label: el.dataset.title,
                        year: parseInt(el.dataset.year) || 0,
                        thumbnail: '',
                        art: {
                            poster: el.dataset.poster ? tmdbImage(el.dataset.poster, 'w780') : null
                        },
                        plot: el.dataset.overview
                    };
                    showDetails(synthetic);
                };
            });
        };
    }
}

async function loadPath(path, label, push = true) {
    showLoading();
    if (push) navStack.push({ path, label });
    renderBreadcrumb();

    const cached = preloadedData[path];
    if (cached) {
        loading.classList.add('hidden');
        renderGrid(cached);
        delete preloadedData[path];
    }

    try {
        const result = await rpc('Files.GetDirectory', {
            directory: path,
            media: 'video',
            properties: ['title', 'plot', 'thumbnail', 'art', 'year', 'season', 'episode', 'showtitle']
        });
        const files = result.files || [];
        loading.classList.add('hidden');
        renderGrid(files);
        if (cached) navStack[navStack.length - 1].stale = false;
    } catch (err) {
        if (!cached) showError(err.message);
    }
}

async function preloadNextEpisodes() {
    try {
        const result = await rpc('Files.GetDirectory', {
            directory: nextEpisodesPath,
            media: 'video',
            properties: ['title', 'plot', 'thumbnail', 'art', 'year', 'season', 'episode', 'showtitle']
        });
        preloadedData[nextEpisodesPath] = result.files || [];
    } catch {}
}

function renderGrid(files) {
    grid.innerHTML = '';
    if (files.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#888;padding:40px;">No items found</div>';
        return;
    }

    for (const item of files) {
        const card = document.createElement('div');
        card.className = 'card';

        const thumb = thumbUrl(item.thumbnail || item.art?.poster || item.art?.icon || item.art?.fanart);
        const thumbDiv = document.createElement('div');
        thumbDiv.className = 'thumb';
        if (thumb) {
            const img = document.createElement('img');
            img.src = thumb;
            img.alt = item.label;
            img.onerror = () => { img.style.display = 'none'; thumbDiv.textContent = item.label.slice(0, 2).toUpperCase(); };
            thumbDiv.appendChild(img);
        } else {
            thumbDiv.textContent = item.label.slice(0, 2).toUpperCase();
        }
        card.appendChild(thumbDiv);

        const info = document.createElement('div');
        info.className = 'info';

        const title = document.createElement('div');
        title.className = 'title';
        title.textContent = item.label.replace(/\[\/?COLOR[^\]]*\]/gi, '');
        info.appendChild(title);

        const meta = document.createElement('div');
        meta.className = 'meta';
        const typeText = item.showtitle ? `${item.showtitle} S${item.season}E${item.episode}` : (item.year > 0 ? item.year : item.type);
        meta.innerHTML = `<span>${typeText}</span>` + (item.type ? `<span class="badge">${item.type}</span>` : '');
        info.appendChild(meta);

        card.appendChild(info);

        card.onclick = () => showDetails(item);

        grid.appendChild(card);
    }
}

async function play(file) {
    try {
        await rpc('Player.Open', { item: { file } });
    } catch (err) {
        alert('Play failed: ' + err.message);
    }
}

async function getStreamUrl(file) {
    await rpc('Player.Open', { item: { file } });
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 500));
        const players = await rpc('Player.GetActivePlayers', {});
        if (players && players.length > 0) {
            const playerId = players[0].playerid;
            const itemResult = await rpc('Player.GetItem', {
                playerid: playerId,
                properties: ['file']
            });
            const resolved = itemResult?.item?.file;
            if (resolved && !resolved.startsWith('plugin://')) {
                try {
                    await rpc('Player.Stop', { playerid: playerId });
                } catch {}
                return resolved;
            }
        }
    }
    throw new Error('Playback did not resolve to a stream URL');
}

document.querySelectorAll('.sidebar button[data-path]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.sidebar button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        navStack = [];
        loadPath(btn.dataset.path, btn.textContent);
    });
});

searchBtn.addEventListener('click', async () => {
    const q = searchInput.value.trim();
    if (!q) return;
    navStack = [];
    const filter = document.getElementById('searchFilter').value;
    showLoading();
    breadcrumb.innerHTML = `<span>Search: ${q}</span>`;

    let files = [];
    if (filter === 'movies' || filter === 'both') {
        try {
            const result = await rpc('Files.GetDirectory', {
                directory: `plugin://${POV}/?mode=build_movie_list&action=tmdb_movies_search&query=${encodeURIComponent(q)}`,
                media: 'video',
                properties: ['title', 'plot', 'thumbnail', 'art', 'year', 'season', 'episode', 'showtitle']
            });
            files = files.concat(result.files || []);
        } catch {}
    }
    if (filter === 'tv' || filter === 'both') {
        try {
            const result = await rpc('Files.GetDirectory', {
                directory: `plugin://${POV}/?mode=build_tvshow_list&action=tmdb_tv_search&query=${encodeURIComponent(q)}`,
                media: 'video',
                properties: ['title', 'plot', 'thumbnail', 'art', 'year', 'season', 'episode', 'showtitle']
            });
            files = files.concat(result.files || []);
        } catch {}
    }

    loading.classList.add('hidden');
    renderGrid(files);
});

searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchBtn.click();
});

function openVideoPlayer(url) {
    videoPlayer.src = url;
    videoModal.classList.remove('hidden');
}

function closeVideoPlayer() {
    videoPlayer.pause();
    videoPlayer.src = '';
    videoModal.classList.add('hidden');
}

videoModalBackdrop.onclick = closeVideoPlayer;
videoModalClose.onclick = closeVideoPlayer;
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !videoModal.classList.contains('hidden')) closeVideoPlayer(); });

// Player bar
async function updatePlayer() {
    try {
        const players = await rpc('Player.GetActivePlayers', {});
        if (!players || players.length === 0) {
            hidePlayer();
            return;
        }
        const playerId = players[0].playerid;
        const [itemResult, propsResult] = await Promise.all([
            rpc('Player.GetItem', { playerid: playerId, properties: ['title', 'thumbnail', 'art', 'showtitle', 'season', 'episode', 'artist'] }),
            rpc('Player.GetProperties', { playerid: playerId, properties: ['speed', 'percentage', 'time', 'totaltime'] })
        ]);
        const item = itemResult.item;
        const props = propsResult;
        showPlayer(item, props);
    } catch {
        hidePlayer();
    }
}

function showPlayer(item, props) {
    const imgUrl = thumbUrl(item.thumbnail || item.art?.thumb || item.art?.poster);
    if (imgUrl) {
        playerThumb.innerHTML = `<img src="${imgUrl}" alt="" onerror="this.style.display='none';this.parentElement.textContent='${(item.title || '?').slice(0,1)}'">`;
    } else {
        playerThumb.textContent = (item.title || item.label || '?').slice(0, 1);
    }

    let label = item.title || item.label || 'Unknown';
    if (item.showtitle) label = `${item.showtitle} — ${label}`;
    else if (item.artist && item.artist.length) label = `${item.artist.join(', ')} — ${label}`;
    playerTitle.textContent = label;

    playerProgressBar.style.width = `${props.percentage || 0}%`;
    playerPlayPause.textContent = props.speed > 0 ? '⏸' : '▶';

    playerBar.classList.remove('hidden');
}

function hidePlayer() {
    playerBar.classList.add('hidden');
}

playerPlayPause.onclick = async () => {
    try {
        const players = await rpc('Player.GetActivePlayers', {});
        if (players && players.length > 0) {
            await rpc('Player.PlayPause', { playerid: players[0].playerid });
            updatePlayer();
        }
    } catch {}
};

playerStop.onclick = async () => {
    try {
        const players = await rpc('Player.GetActivePlayers', {});
        if (players && players.length > 0) {
            await rpc('Player.Stop', { playerid: players[0].playerid });
            hidePlayer();
        }
    } catch {}
};

playerPollInterval = setInterval(updatePlayer, 2500);
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        clearInterval(playerPollInterval);
    } else {
        playerPollInterval = setInterval(updatePlayer, 2500);
        updatePlayer();
    }
});
updatePlayer();

// Load Trending Movies by default, then preload Next Episodes in background
document.querySelector('.sidebar button[data-path*="build_movie_list"]').click();
setTimeout(preloadNextEpisodes, 2000);
