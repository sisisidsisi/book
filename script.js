// --- [설정] 구글 앱 스크립트 배포 URL (데이터 쓰기용) ---
const GAS_RECOMMEND_URL = 'https://script.google.com/macros/s/AKfycbzmQiwCxdlksvksA6g2H0G8kZLM8E9S51pW8pUyN1AIev1g-MnkmuTSqwYrSeA8tClp/exec';
const GAS_RECRUIT_URL = 'https://script.google.com/macros/s/AKfycbx2BiLeFyVYU9L467vBllQsbI2FPpnoHQh4IsPD37bSSw9TKOFddfe_WzHFDRRMPQv1Fg/exec';

// --- [설정] 구글 시트 ID (데이터 읽기용 - 웹에 게시된 CSV) ---
const SHEET_ID_RECRUIT = '1MPl-CxjbvgA1jt0BUD28B9K-sFXCY5tsURmcVlHRb3A';
const SHEET_ID_RECOMMEND = '17BglRBld0Po3GAEdTCm2Z7mqRCDIbnj3PdXXjmifnP4'; 

// --- [샘플 데이터] ---
const SAMPLE_RECRUITS = [
    { title: "모순", author: "양귀자", badge: "1/4", img: "https://via.placeholder.com/160x220/FFD1DC/ffffff?text=모순" },
    { title: "물고기는 존재하지 않는다", author: "룰루 밀러", badge: "모집중", img: "https://via.placeholder.com/160x220/AEEEEE/ffffff?text=물고기" },
    { title: "어서 오세요 휴남동 서점입니다", author: "황보름", badge: "2/3", img: "https://via.placeholder.com/160x220/E0E0E0/333333?text=휴남동" }
];

const SAMPLE_RECOMMENDS = [
    { title: "세이노의 가르침", author: "세이노", img: "https://via.placeholder.com/160x220/333333/ffffff?text=세이노" },
    { title: "도둑맞은 집중력", author: "요한 하리", img: "https://via.placeholder.com/160x220/FFAB91/ffffff?text=집중력" },
    { title: "역행자", author: "자청", img: "https://via.placeholder.com/160x220/FFCC80/ffffff?text=역행자" },
    { title: "구의 증명", author: "최진영", img: "https://via.placeholder.com/160x220/CE93D8/ffffff?text=구의증명" }
];

// --- [전역 변수] ---
let historyStack = ['home'];
let currentDetailBook = null; 

// --- [초기화] 페이지 로드 시 실행 (오류 수정 핵심) ---
document.addEventListener('DOMContentLoaded', () => {
    // 현재 페이지가 index.html 일 때만 데이터 로드
    if(document.getElementById('recruit-list')) {
        loadRecruitData();
        loadRecommendData();
    }
});

// --- API: 책 표지 찾기 ---
async function fetchBookCover(title) {
    try {
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(title)}&maxResults=1`);
        const data = await response.json();
        if (data.items && data.items.length > 0) {
            let imgUrl = data.items[0].volumeInfo.imageLinks?.thumbnail;
            if (imgUrl) return imgUrl.replace(/^http:\/\//i, 'https://');
        }
    } catch (e) { console.error("이미지 검색 실패:", e); }
    return "https://via.placeholder.com/160x220/cccccc/ffffff?text=Book";
}

// --- 이미지 업데이트 헬퍼 ---
async function updateImagesForList(list) {
    const promises = list.map(async (item) => {
        if (!item.img || item.img.includes('via.placeholder.com')) {
            const newImg = await fetchBookCover(item.title);
            if (newImg) item.img = newImg;
        }
        return item;
    });
    return Promise.all(promises);
}

// --- 모집 리스트 로드 ---
async function loadRecruitData() {
    const container = document.getElementById('recruit-list');
    if(!container) return; 
    
    let localData = JSON.parse(localStorage.getItem('myRecruits')) || [];
    
    try {
        const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID_RECRUIT}/pub?output=csv`);
        const text = await res.text();
        const rows = text.split('\n').slice(1);
        
        let sheetData = [];
        for (let row of rows) {
            const cols = row.split(',');
            if (cols.length < 1 || !cols[0]) continue;
            sheetData.push({
                title: cols[0].trim(),
                author: cols[1]?.trim() || '',
                img: (cols[2] && cols[2].startsWith('http')) ? cols[2].trim() : null, 
                badge: cols[4]?.trim() || '모집중' 
            });
        }

        let finalData = [...localData, ...sheetData];
        if (finalData.length === 0) finalData = JSON.parse(JSON.stringify(SAMPLE_RECRUITS));

        renderRecruits(finalData, container, true);
        
        updateImagesForList(finalData).then(updatedData => {
            renderRecruits(updatedData, container, true);
        });
        
        filterBooks();

    } catch(e) { 
        console.error("Recruit load fail", e); 
        let fallbackData = [...localData];
        if(fallbackData.length === 0) fallbackData = JSON.parse(JSON.stringify(SAMPLE_RECRUITS));
        renderRecruits(fallbackData, container, true);
        updateImagesForList(fallbackData).then(updated => renderRecruits(updated, container, true));
    }
}

function renderRecruits(list, container, clear) {
    if(clear) container.innerHTML = '';
    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'card-tall';
        div.onclick = () => openExchangeDetail(item);
        
        const imgTag = item.img 
            ? `<img src="${item.img}" alt="표지" onerror="this.src='https://via.placeholder.com/160x220/e0e0e0/333333?text=Book'">` 
            : `<div class="loading-skeleton" style="height:190px; margin-bottom:12px;"></div>`;
            
        div.innerHTML = `
            <div class="recruit-badge">${item.badge || 'NEW'}</div>
            ${imgTag}
            <div class="book-info-lg">
                <div class="book-title-lg" style="margin-top:10px; font-weight:bold;">${item.title}</div>
                <div class="book-desc-lg" style="font-size:12px; color:#888;">${item.author}</div>
            </div>
        `;
        container.appendChild(div);
    });
}

// --- 추천 리스트 로드 ---
async function loadRecommendData() {
    const container = document.getElementById('recommend-list');
    if(!container) return;

    try {
        const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID_RECOMMEND}/pub?output=csv`);
        const text = await res.text();
        const rows = text.split('\n').slice(1);
        
        let recommendList = [];
        for (let row of rows) {
            const cols = row.split(',');
            if (cols.length < 1 || !cols[0]) continue;
            
            recommendList.push({
                title: cols[0].trim(),
                author: cols[1]?.trim() || '추천 도서',
                img: (cols[2] && cols[2].startsWith('http')) ? cols[2].trim() : null
            });
        }

        if (recommendList.length === 0) recommendList = JSON.parse(JSON.stringify(SAMPLE_RECOMMENDS));

        renderRecommends(recommendList, container);
        updateImagesForList(recommendList).then(updatedList => renderRecommends(updatedList, container));
        filterBooks();

    } catch(e) { 
        console.error(e); 
        let fallback = JSON.parse(JSON.stringify(SAMPLE_RECOMMENDS));
        renderRecommends(fallback, container);
        updateImagesForList(fallback).then(updated => renderRecommends(updated, container));
    }
}

function renderRecommends(list, container) {
    container.innerHTML = '';
    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'card-grid';
        div.onclick = () => openExchangeDetail(item);
        
        const imgTag = item.img 
            ? `<img src="${item.img}" alt="표지" onerror="this.src='https://via.placeholder.com/160x220/e0e0e0/333333?text=Book'">` 
            : `<div class="loading-skeleton" style="height:160px; margin-bottom:10px;"></div>`;

        div.innerHTML = `
            ${imgTag}
            <div class="book-title">${item.title}</div>
            <div class="book-author">${item.author}</div>
            <div class="join-count">🔥 인기</div>
        `;
        container.appendChild(div);
    });
}

// --- [기능] 검색 필터링 ---
function filterBooks() {
    const input = document.getElementById('searchInput');
    if(!input) return;
    const query = input.value.toLowerCase().trim();
    
    document.querySelectorAll('.card-tall').forEach(card => {
        const text = card.innerText.toLowerCase();
        card.style.display = text.includes(query) ? 'flex' : 'none';
    });

    document.querySelectorAll('.card-grid').forEach(card => {
        const text = card.innerText.toLowerCase();
        card.style.display = text.includes(query) ? 'block' : 'none';
    });
}

// --- 인원수 선택 ---
function selectMember(element) {
    const parent = element.parentElement;
    parent.querySelectorAll('div').forEach(opt => {
        opt.style.background = 'white';
        opt.style.color = '#333';
        opt.style.borderColor = '#ddd';
        opt.style.fontWeight = 'normal';
        opt.classList.remove('selected');
    });
    element.classList.add('selected');
    element.style.background = '#E0F2F1';
    element.style.color = '#009688';
    element.style.borderColor = '#009688';
    element.style.fontWeight = 'bold';
}

// --- 모임 만들기 (GAS 전송) ---
async function submitRecruit() {
    const title = document.getElementById('new-book-title').value.trim();
    const author = document.getElementById('new-book-author').value.trim();
    const selectedMember = document.querySelector('.selected');
    const memberCount = selectedMember ? selectedMember.innerText : '3명'; 
    const btn = document.querySelector('.btn-full');

    if (!title) { alert('도서명을 입력해주세요.'); return; }
    
    btn.innerText = "저장 중...";
    btn.disabled = true;

    const imgUrl = await fetchBookCover(title);

    try {
        await fetch(GAS_RECRUIT_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title, author: author, img: imgUrl, memberCount: memberCount })
        });

        // 내가 만든 모임(myRecruits)에 저장
        const stored = JSON.parse(localStorage.getItem('myRecruits')) || [];
        stored.unshift({ title, author, img: imgUrl, badge: memberCount });
        localStorage.setItem('myRecruits', JSON.stringify(stored));

        window.location.href = 'result.html';

    } catch (e) {
        alert('오류가 발생했습니다: ' + e);
        btn.innerText = "모임 등록하기";
        btn.disabled = false;
    }
}

// --- 상세 페이지 열기 ---
function openExchangeDetail(item) {
    currentDetailBook = item; 
    
    const t = document.getElementById('ex-detail-title');
    const d = document.getElementById('ex-detail-dday');
    
    if(t && d) { 
        t.innerText = item.title; 
        d.innerText = (item.badge && item.badge.includes('/')) ? '모집중' : (item.badge || 'D-Day'); 
        switchTab('exchange-detail'); 
    }
}

// --- [기능] 모임 참여하기 ---
function joinCurrentBook() {
    if (!currentDetailBook) return;

    const joined = JSON.parse(localStorage.getItem('myJoinedExchanges')) || [];
    const isAlreadyJoined = joined.some(book => book.title === currentDetailBook.title);
    if (isAlreadyJoined) {
        alert("이미 참여 중인 모임입니다!");
        return;
    }

    joined.unshift(currentDetailBook);
    localStorage.setItem('myJoinedExchanges', JSON.stringify(joined));

    alert(`'${currentDetailBook.title}' 모임에 참여했습니다! 🎉`);
    switchTab('exchange'); 
}

// --- [기능] 교환 탭 렌더링 ---
function loadExchangeTab() {
    const hostingList = document.getElementById('hosting-list');
    const joinedList = document.getElementById('joined-list');
    
    if (hostingList) {
        const myRecruits = JSON.parse(localStorage.getItem('myRecruits')) || [];
        renderExchangeList(myRecruits, hostingList, '내가 만든 모임이 없습니다.');
    }
    
    if (joinedList) {
        const myJoined = JSON.parse(localStorage.getItem('myJoinedExchanges')) || [];
        renderExchangeList(myJoined, joinedList, '참여 중인 모임이 없습니다.');
    }
}

function renderExchangeList(list, container, emptyMsg) {
    container.innerHTML = '';
    if (list.length === 0) {
        container.innerHTML = `<div style="color:#999; font-size:13px; padding:10px; text-align:center;">${emptyMsg}</div>`;
        return;
    }

    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'progress-card';
        div.onclick = () => openExchangeDetail(item);
        
        const progress = Math.floor(Math.random() * 80) + 10; 
        
        div.innerHTML = `
            <div style="flex:1;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="font-size:16px;">${item.title}</h3>
                    <span style="font-size:12px; font-weight:bold; color:#7BC4B2;">진행중</span>
                </div>
                <div class="progress-bar-area"><div class="progress-bar-fill" style="width: ${progress}%;"></div></div>
                <p style="font-size:11px; color:#888; margin-top:5px;">나의 진행률: ${progress}%</p>
            </div>
            <div style="font-size:20px; margin-left:15px; color:#ddd;">❯</div>
        `;
        container.appendChild(div);
    });
}

// --- 탭 전환 / UI ---
function switchTab(tabId, isBack = false) {
    if (!isBack) {
        if(['home', 'exchange', 'my'].includes(tabId)) historyStack = [tabId];
        else historyStack.push(tabId);
    }
    
    if (tabId === 'exchange') {
        loadExchangeTab();
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(tabId);
    if(target) target.classList.add('active');
    window.scrollTo(0,0);
    
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const navs = document.querySelectorAll('.nav-item');
    if(navs.length >= 3) {
        if(tabId === 'home') navs[0].classList.add('active');
        if(tabId.startsWith('exchange')) navs[1].classList.add('active');
        if(tabId === 'my' || tabId.startsWith('settings')) navs[2].classList.add('active');
    }

    const fab = document.querySelector('.fab');
    if(fab) fab.style.display = (tabId === 'exchange') ? 'flex' : 'none';
}

function goBack() {
    if(historyStack.length > 1) {
        historyStack.pop();
        switchTab(historyStack[historyStack.length - 1], true);
    } else {
        if(document.referrer && window.location.pathname.includes('register')) {
            window.location.href = 'index.html';
        } else {
            switchTab('home', true);
        }
    }
}

function addReview() { 
    const i=document.getElementById('review-input'); 
    const l=document.getElementById('review-list');
    if(i && l && i.value.trim()){ 
        l.innerHTML+=`<div class="review-bubble me">${i.value}</div>`; 
        i.value=''; l.scrollTop=l.scrollHeight; 
    }
}

function saveProfile() { 
    const n=document.getElementById('edit-nickname'); 
    const d=document.getElementById('my-nickname');
    if(n&&d){ d.innerText=n.value; alert('저장 완료!'); goBack(); }
}

function handleLogout() { if(confirm("로그아웃?")) location.reload(); }
