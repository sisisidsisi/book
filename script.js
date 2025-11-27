// --- [설정] 구글 앱 스크립트 배포 URL (데이터 쓰기용) ---
const GAS_RECOMMEND_URL = 'https://script.google.com/macros/s/AKfycbzmQiwCxdlksvksA6g2H0G8kZLM8E9S51pW8pUyN1AIev1g-MnkmuTSqwYrSeA8tClp/exec';
const GAS_RECRUIT_URL = 'https://script.google.com/macros/s/AKfycbx2BiLeFyVYU9L467vBllQsbI2FPpnoHQh4IsPD37bSSw9TKOFddfe_WzHFDRRMPQv1Fg/exec';

// --- [설정] 구글 시트 ID (데이터 읽기용 - 웹에 게시된 CSV) ---
const SHEET_ID_RECRUIT = '1MPl-CxjbvgA1jt0BUD28B9K-sFXCY5tsURmcVlHRb3A';
const SHEET_ID_RECOMMEND = '17BglRBld0Po3GAEdTCm2Z7mqRCDIbnj3PdXXjmifnP4'; 

// --- [샘플 데이터] 시트가 비어있을 때 보여줄 기본 도서들 (이미지는 자동으로 찾음) ---
const SAMPLE_RECRUITS = [
    { title: "모순", author: "양귀자", badge: "1/4" },
    { title: "물고기는 존재하지 않는다", author: "룰루 밀러", badge: "모집중" },
    { title: "어서 오세요 휴남동 서점입니다", author: "황보름", badge: "2/3" }
];

const SAMPLE_RECOMMENDS = [
    { title: "세이노의 가르침", author: "세이노" },
    { title: "도둑맞은 집중력", author: "요한 하리" },
    { title: "역행자", author: "자청" },
    { title: "구의 증명", author: "최진영" }
];

// --- [전역 변수] ---
let historyStack = ['home'];

// --- API: 책 표지 찾기 (HTTPS 강제 변환 추가) ---
async function fetchBookCover(title) {
    try {
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(title)}&maxResults=1`);
        const data = await response.json();
        if (data.items && data.items.length > 0) {
            let imgUrl = data.items[0].volumeInfo.imageLinks?.thumbnail;
            if (imgUrl) {
                // GitHub Pages 등 HTTPS 환경에서 이미지가 보이도록 http를 https로 변환
                return imgUrl.replace(/^http:\/\//i, 'https://');
            }
        }
    } catch (e) { console.error(e); }
    return "https://via.placeholder.com/160x220/cccccc/ffffff?text=No+Image";
}

// --- 리스트의 이미지 자동 업데이트 헬퍼 함수 ---
async function updateImagesForList(list) {
    // 병렬로 이미지 찾기 수행
    const promises = list.map(async (item) => {
        if (!item.img || item.img.includes('via.placeholder.com')) {
            item.img = await fetchBookCover(item.title);
        }
        return item;
    });
    return Promise.all(promises);
}

// --- 모집 리스트 로드 (시트1 + 로컬 + 샘플) ---
async function loadRecruitData() {
    const container = document.getElementById('recruit-list');
    if(!container) return; 
    
    // 1. 로컬 스토리지 데이터 로드
    let localData = JSON.parse(localStorage.getItem('myRecruits')) || [];
    
    try {
        // 2. 구글 시트 데이터 로드
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
                // 시트에 이미지가 없으면 빈 값으로 둠 (나중에 fetchBookCover로 채움)
                img: (cols[2] && cols[2].startsWith('http')) ? cols[2].trim() : null, 
                badge: cols[4]?.trim() || '모집중' 
            });
        }

        // 3. 데이터 합치기 (로컬 + 시트)
        let finalData = [...localData, ...sheetData];

        // 4. 데이터가 하나도 없으면 샘플 사용
        if (finalData.length === 0) {
            finalData = JSON.parse(JSON.stringify(SAMPLE_RECRUITS)); // 깊은 복사
        }

        // 5. 이미지 없는 항목들 자동으로 채우기
        // 일단 먼저 렌더링(스켈레톤 대신 내용을 보여줌)하고 이미지는 비동기로 업데이트
        renderRecruits(finalData, container, true);
        
        // 이미지 비동기 로드 후 업데이트
        const updatedData = await updateImagesForList(finalData);
        renderRecruits(updatedData, container, true);
        
        filterBooks();

    } catch(e) { 
        console.error("Recruit load fail", e); 
        // 에러 시 로컬+샘플로 표시
        let fallbackData = [...localData];
        if(fallbackData.length === 0) fallbackData = JSON.parse(JSON.stringify(SAMPLE_RECRUITS));
        
        renderRecruits(fallbackData, container, true);
        const updatedFallback = await updateImagesForList(fallbackData);
        renderRecruits(updatedFallback, container, true);
    }
}

function renderRecruits(list, container, clear) {
    if(clear) container.innerHTML = '';
    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'card-tall';
        div.onclick = () => openExchangeDetail(item.title, 'D-Day');
        // 이미지가 로딩 전이면 로딩바 표시
        const imgTag = item.img 
            ? `<img src="${item.img}" alt="표지">` 
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

// --- 추천 리스트 로드 (시트2 + 샘플) ---
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

        // 데이터 없으면 샘플 사용
        if (recommendList.length === 0) {
            recommendList = JSON.parse(JSON.stringify(SAMPLE_RECOMMENDS));
        }

        // 우선 렌더링
        renderRecommends(recommendList, container);

        // 이미지 비동기 업데이트
        const updatedList = await updateImagesForList(recommendList);
        renderRecommends(updatedList, container);
        
        filterBooks();

    } catch(e) { 
        console.error(e); 
        // 에러 시 샘플 사용
        let fallback = JSON.parse(JSON.stringify(SAMPLE_RECOMMENDS));
        renderRecommends(fallback, container);
        const updatedFallback = await updateImagesForList(fallback);
        renderRecommends(updatedFallback, container);
    }
}

function renderRecommends(list, container) {
    container.innerHTML = '';
    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'card-grid';
        div.onclick = () => openExchangeDetail(item.title, '인기');
        
        const imgTag = item.img 
            ? `<img src="${item.img}" alt="표지">` 
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

// --- 검색 필터링 ---
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

// --- 인원수 선택 (register.html) ---
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

    // 등록 시에도 HTTPS 변환된 이미지 사용
    const imgUrl = await fetchBookCover(title);

    try {
        await fetch(GAS_RECRUIT_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title, author: author, img: imgUrl, memberCount: memberCount })
        });

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

// --- 탭 전환 / UI ---
function switchTab(tabId, isBack = false) {
    if (!isBack) {
        if(['home', 'exchange', 'my'].includes(tabId)) historyStack = [tabId];
        else historyStack.push(tabId);
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

function openExchangeDetail(title, dday) { 
    const t = document.getElementById('ex-detail-title');
    const d = document.getElementById('ex-detail-dday');
    if(t && d) { t.innerText = title; d.innerText = dday; switchTab('exchange-detail'); }
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
