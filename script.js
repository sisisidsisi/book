document.addEventListener('DOMContentLoaded', () => {
    // 캘린더 요소가 있는지 확인 (등록 페이지인 경우에만 실행)
    const calendarGrid = document.getElementById('calendarGrid');
    
    if (calendarGrid) {
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        const exchangeForm = document.getElementById('exchangeForm');
        
        let selectedDates = []; 

        const totalDays = 31;
        const startDayIndex = 1; 

        function renderCalendar() {
            calendarGrid.innerHTML = '';
            for (let i = 0; i < startDayIndex; i++) {
                const emptyDiv = document.createElement('div');
                calendarGrid.appendChild(emptyDiv);
            }
            for (let d = 1; d <= totalDays; d++) {
                const dateEl = document.createElement('div');
                dateEl.classList.add('date-item');
                dateEl.textContent = d;
                dateEl.dataset.day = d;
                dateEl.addEventListener('click', () => handleDateClick(d));
                calendarGrid.appendChild(dateEl);
            }
        }

        function handleDateClick(day) {
            if (selectedDates.length === 2) {
                resetSelection();
                selectedDates.push(day);
            } else if (selectedDates.length === 1) {
                if (day < selectedDates[0]) {
                    selectedDates.unshift(day);
                } else {
                    selectedDates.push(day);
                }
            } else {
                selectedDates.push(day);
            }
            updateCalendarUI();
            updateInputFields();
        }

        function resetSelection() {
            selectedDates = [];
            const allDates = document.querySelectorAll('.date-item');
            allDates.forEach(el => el.classList.remove('selected', 'in-range', 'range-start', 'range-end'));
        }

        function updateCalendarUI() {
            const allDates = document.querySelectorAll('.date-item');
            allDates.forEach(el => {
                const day = parseInt(el.dataset.day);
                el.classList.remove('selected', 'in-range', 'range-start', 'range-end');
                
                if (selectedDates.includes(day)) el.classList.add('selected');
                
                if (selectedDates.length === 2) {
                    if (day > selectedDates[0] && day < selectedDates[1]) el.classList.add('in-range');
                    if (day === selectedDates[0]) el.classList.add('range-start');
                    if (day === selectedDates[1]) el.classList.add('range-end');
                }
            });
        }

        function updateInputFields() {
            if (selectedDates.length > 0) startDateInput.value = `5월 ${selectedDates[0]}일`;
            if (selectedDates.length === 2) endDateInput.value = `5월 ${selectedDates[1]}일`;
            else endDateInput.value = '';
        }

        exchangeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const bookTitle = document.getElementById('bookTitle').value;
            const memberCount = document.getElementById('memberCount').value;

            if(!bookTitle || !memberCount || selectedDates.length < 2) {
                alert('모든 정보를 입력하고 기간을 설정해주세요.');
                return;
            }

            const queryParams = new URLSearchParams({
                book: bookTitle,
                count: memberCount,
                start: startDateInput.value,
                end: endDateInput.value
            }).toString();

            window.location.href = `result.html?${queryParams}`;
        });

        renderCalendar();
    }
});