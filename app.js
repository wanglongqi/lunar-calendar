// Get dynamic year range from loaded data
const AVAILABLE_YEARS = Object.keys(CALENDAR_DATA).map(Number).sort((a, b) => a - b);
const MIN_YEAR = AVAILABLE_YEARS[0];
const MAX_YEAR = AVAILABLE_YEARS[AVAILABLE_YEARS.length - 1];

let currentYear = new Date().getFullYear();
if (currentYear < MIN_YEAR || currentYear > MAX_YEAR) currentYear = AVAILABLE_YEARS[Math.floor(AVAILABLE_YEARS.length / 2)];
let yearData = null;

const LUNAR_DAY_NAMES = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

const LUNAR_MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const GREG_MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const SOLAR_TERM_EMOJIS = {
    '小寒': '🧊', '大寒': '🥶', '立春': '🌱', '雨水': '☔', '惊蛰': '🐛', '春分': '🌸',
    '清明': '🍃', '谷雨': '🌾', '立夏': '☀️', '小满': '🌿', '芒种': '🌾', '夏至': '🌞',
    '小暑': '🎐', '大暑': '🔥', '立秋': '🍂', '处暑': '🌤️', '白露': '🌫️', '秋分': '🌓',
    '寒露': '💧', '霜降': '❄️', '立冬': '🧣', '小雪': '🌨️', '大雪': '☃️', '冬至': '🥣'
};

function getGanzhi(offset) {
    return STEMS[offset % 10] + BRANCHES[offset % 12];
}

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const yearParam = urlParams.get('year');
    if (yearParam) {
        const parsedYear = parseInt(yearParam);
        if (!isNaN(parsedYear) && parsedYear >= MIN_YEAR && parsedYear <= MAX_YEAR) {
            currentYear = parsedYear;
        }
    }

    initControls();
    loadYear(currentYear);
});

function initControls() {
    const yearInput = document.getElementById('year-input');
    yearInput.value = currentYear;
    yearInput.min = MIN_YEAR;
    yearInput.max = MAX_YEAR;

    document.querySelectorAll('.year-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const delta = parseInt(btn.dataset.delta);
            const newYear = currentYear + delta;
            if (newYear >= MIN_YEAR && newYear <= MAX_YEAR) {
                currentYear = newYear;
                yearInput.value = currentYear;
                loadYear(currentYear);
            }
        });
    });

    yearInput.addEventListener('change', () => {
        const val = parseInt(yearInput.value);
        if (val >= MIN_YEAR && val <= MAX_YEAR) {
            currentYear = val;
            loadYear(currentYear);
        }
    });

    yearInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') yearInput.blur();
    });

    document.querySelector('.modal-close').addEventListener('click', closeModal);
    document.getElementById('day-modal').addEventListener('click', (e) => {
        if (e.target.id === 'day-modal') closeModal();
    });
}

async function loadYear(year) {
    const loading = document.getElementById('loading');
    const calendarGrid = document.getElementById('calendar-grid');

    loading.classList.add('active');
    calendarGrid.style.opacity = '0.3';

    const url = new URL(window.location);
    url.searchParams.set('year', year);
    window.history.pushState({}, '', url);

    // Static loading from CALENDAR_DATA constant
    setTimeout(() => {
        const d = CALENDAR_DATA[year];
        if (d) {
            const baseJd = Math.floor(gregorianToJD(year, 1, 1) + 0.5);

            // Rehydrate months
            let currentJd = baseJd + d[0][0];
            const months = [];
            for (let i = 1; i < d[0].length; i++) {
                const v = d[0][i];
                const days = (v & 1) + 29;
                months.push({
                    month: v >> 2,
                    is_leap: ((v >> 1) & 1) === 1,
                    start_jd: currentJd,
                    days: days
                });
                currentJd += days;
            }

            // Rehydrate solar terms
            const SOLAR_TERMS_LIST = ['小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至'];
            const solar_terms = d[1].map((offset, idx) => ({
                name: SOLAR_TERMS_LIST[idx] || '未知',
                start_jd: baseJd + offset
            }));

            // Rehydrate eclipses
            const eclipses = { solar: [], lunar: [] };
            if (d.length > 2) {
                const parseE = (arr) => arr.map(e => {
                    const e_jd = baseJd + e[0];
                    const julian = jdToJulianCalendar(e_jd);
                    return {
                        date: `${julian.year}-${String(julian.month).padStart(2, '0')}-${String(julian.day).padStart(2, '0')}`,
                        time: e[1],
                        type: e[2]
                    };
                });
                eclipses.solar = parseE(d[2][0] || []);
                eclipses.lunar = parseE(d[2][1] || []);
            }

            // Rehydrate compact array format to rendering format
            yearData = {
                year: year,
                ganzhi: getGanzhi(year - 4),
                months: months,
                solar_terms: solar_terms,
                eclipses: eclipses
            };
            displayYear(yearData);
        } else {
            alert(`年份 ${year} 不在静态版支持范围内 (${MIN_YEAR}-${MAX_YEAR})`);
        }
        loading.classList.remove('active');
        calendarGrid.style.opacity = '1';
    }, 50);
}

function displayYear(data) {
    document.title = `${data.year}年 (${data.ganzhi}) NASA DE441 万年历`;
    document.getElementById('ganzhi-display').textContent = data.ganzhi;
    document.getElementById('dynamic-subtitle').textContent = `NASA DE441 高精度天文学万年历 (${MIN_YEAR}-${MAX_YEAR})`;

    document.getElementById('print-title').innerHTML = `
        <div class="print-year">${data.year}</div>
        <div class="print-subtitle">「 ${data.ganzhi}年 」 NASA DE441 万年历</div>
    `;

    displayEclipsesBanner(data.eclipses);

    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    const gregorianMonths = buildGregorianYear(data.year);
    const lunarMonthMap = buildLunarMonthMap(data.months);
    const solarTermMap = buildSolarTermMap(data.solar_terms || []);

    for (let gMonth = 1; gMonth <= 12; gMonth++) {
        const card = createMonthCard(data.year, gMonth, gregorianMonths[gMonth], lunarMonthMap, data.eclipses, solarTermMap);
        grid.appendChild(card);
    }
}

function buildGregorianYear(year) {
    const months = {};
    for (let m = 1; m <= 12; m++) {
        const daysInMonth = new Date(year, m, 0).getDate();
        months[m] = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, m - 1, d);
            months[m].push({
                gregorian: { year, month: m, day: d },
                weekday: date.getDay(),
                jd: gregorianToJD(year, m, d)
            });
        }
    }
    return months;
}

function buildLunarMonthMap(months) {
    const map = {};
    const starts = months.map(m => m.start_jd);
    months.forEach((m, idx) => {
        const startKey = starts[idx];
        const endKey = startKey + m.days - 1;
        for (let jd = startKey; jd <= endKey; jd++) {
            map[jd] = {
                lunarMonth: m.month,
                lunarDay: jd - startKey + 1,
                isLeap: m.is_leap
            };
        }
    });
    return map;
}

function buildSolarTermMap(solarTerms) {
    const map = {};
    solarTerms.forEach(t => {
        map[t.start_jd] = t.name;
    });
    return map;
}

function gregorianToJD(year, month, day) {
    if (month <= 2) { year -= 1; month += 12; }
    const A = Math.floor(year / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

function jdToJulianCalendar(jd) {
    const Z = jd;
    const B = Z + 1524;
    const C = Math.floor((B - 122.1) / 365.25);
    const D = Math.floor(365.25 * C);
    const E = Math.floor((B - D) / 30.6001);

    const day = B - D - Math.floor(30.6001 * E);
    const month = E < 14 ? E - 1 : E - 13;
    const year = month > 2 ? C - 4716 : C - 4715;

    return { year, month, day };
}

function createMonthCard(year, gMonth, days, lunarMonthMap, eclipses, solarTermMap) {
    const card = document.createElement('div');
    card.className = 'month-card';

    const hasLeapMonthStart = days.some(d => {
        const lunar = lunarMonthMap[Math.floor(d.jd + 0.5)];
        return lunar && lunar.lunarDay === 1 && lunar.isLeap;
    });

    if (hasLeapMonthStart) card.classList.add('leap-month');

    const header = document.createElement('div');
    header.className = 'month-header';
    header.innerHTML = `<span class="month-greg">${GREG_MONTH_NAMES[gMonth - 1]}</span>`;
    card.appendChild(header);

    const weekdays = document.createElement('div');
    weekdays.className = 'weekdays';
    WEEKDAYS.forEach((w, i) => {
        const wd = document.createElement('div');
        wd.className = 'weekday';
        if (i === 0) wd.classList.add('sunday');
        if (i === 6) wd.classList.add('saturday');
        wd.textContent = w;
        weekdays.appendChild(wd);
    });
    card.appendChild(weekdays);

    const daysGrid = document.createElement('div');
    daysGrid.className = 'days-grid';

    const startWeekday = days[0].weekday;
    for (let i = 0; i < startWeekday; i++) {
        const empty = document.createElement('div');
        empty.className = 'day-cell empty';
        daysGrid.appendChild(empty);
    }

    const today = new Date();
    const isCurrentYear = today.getFullYear() === year;
    const isCurrentMonth = isCurrentYear && (today.getMonth() + 1) === gMonth;

    days.forEach(dayInfo => {
        const cell = document.createElement('div');
        cell.className = 'day-cell';

        const jd = Math.floor(dayInfo.jd + 0.5);
        const lunar = lunarMonthMap[jd];
        const solarTerm = solarTermMap[jd];

        if (isCurrentMonth && today.getDate() === dayInfo.gregorian.day) {
            cell.classList.add('today');
        }

        const solarEclipse = eclipses.solar.find(e => e.date === `${year}-${String(gMonth).padStart(2, '0')}-${String(dayInfo.gregorian.day).padStart(2, '0')}`);
        const lunarEclipse = eclipses.lunar.find(e => e.date === `${year}-${String(gMonth).padStart(2, '0')}-${String(dayInfo.gregorian.day).padStart(2, '0')}`);

        if (solarEclipse) cell.classList.add('has-solar-eclipse');
        if (lunarEclipse) cell.classList.add('has-lunar-eclipse');
        if (solarTerm) cell.classList.add('has-solar-term');

        let lunarDisplay = '-';
        let isMonthStart = false;
        if (lunar) {
            if (lunar.lunarDay === 1) {
                lunarDisplay = (lunar.isLeap ? '闰' : '') + LUNAR_MONTH_NAMES[lunar.lunarMonth - 1] + '月';
                isMonthStart = true;
            } else {
                lunarDisplay = LUNAR_DAY_NAMES[lunar.lunarDay - 1];
            }
        }

        cell.innerHTML = `
            ${(solarEclipse || lunarEclipse) ? `<div class="bg-indicator ${solarEclipse ? 'solar-eclipse' : 'lunar-eclipse'}">${solarEclipse ? '🌑' : '🌕'}</div>` : ''}
            <div class="indicator-group">
                ${solarTerm ? `<span class="indicator-item">${SOLAR_TERM_EMOJIS[solarTerm] || '🌿'}</span>` : ''}
            </div>
            <div class="gregorian-day">${dayInfo.gregorian.day}</div>
            <div class="lunar-day ${isMonthStart ? 'month-start' : ''}">
                ${solarTerm ? solarTerm : lunarDisplay}
            </div>
        `;

        cell.addEventListener('click', () => showDayModal(dayInfo, lunar, solarEclipse, lunarEclipse, solarTerm));
        daysGrid.appendChild(cell);
    });

    card.appendChild(daysGrid);
    return card;
}

function displayEclipsesBanner(eclipses) {
    const banner = document.getElementById('eclipses-banner');
    banner.innerHTML = '';
    const allEclipses = [
        ...eclipses.solar.map(e => ({ ...e, isSolar: true })),
        ...eclipses.lunar.map(e => ({ ...e, isSolar: false }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    allEclipses.forEach(e => {
        const item = document.createElement('div');
        item.className = 'eclipse-item';
        const typeNames = { 'T': '全食', 'A': '环食', 'P': '偏食', 'H': '混合', 'N': '半影' };
        item.innerHTML = `
            <span class="eclipse-icon">${e.isSolar ? '🌑' : '🌕'}</span>
            <div class="eclipse-info">
                <span class="eclipse-date">${e.date}</span>
                <span class="eclipse-type">${e.isSolar ? '日' : '月'}${typeNames[e.type] || e.type}</span>
            </div>
        `;
        banner.appendChild(item);
    });
}

function showDayModal(dayInfo, lunar, solarEclipse, lunarEclipse, solarTerm) {
    const modal = document.getElementById('day-modal');
    const body = document.getElementById('modal-body');
    const g = dayInfo.gregorian;
    const gregorianStr = `${g.year}年${g.month}月${g.day}日`;
    let lunarStr = '无数据', ganzhiStr = '-';

    if (lunar) {
        lunarStr = `${lunar.isLeap ? '闰' : ''}${LUNAR_MONTH_NAMES[lunar.lunarMonth - 1]}月${LUNAR_DAY_NAMES[lunar.lunarDay - 1]}`;
        const jd = Math.floor(dayInfo.jd + 0.5);
        const dayGanzhi = getGanzhi(jd + 49);
        const yearStem = yearData.ganzhi[0];
        const yearStemIdx = STEMS.indexOf(yearStem);
        const mStemIdx = ((yearStemIdx * 2 + 2) + (lunar.lunarMonth - 1)) % 10;
        const monthBranches = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
        const monthGanzhi = STEMS[mStemIdx] + monthBranches[(lunar.lunarMonth - 1) % 12];
        ganzhiStr = `${yearData.ganzhi}年 ${monthGanzhi}月 ${dayGanzhi}日`;
    }

    let eclipseHtml = '';
    if (solarTerm) eclipseHtml += `<div class="modal-row"><span class="modal-label">节气</span><span class="modal-value" style="color: var(--accent-blue);">${SOLAR_TERM_EMOJIS[solarTerm]} ${solarTerm}</span></div>`;
    if (solarEclipse) eclipseHtml += `<div class="modal-row"><span class="modal-label">日食</span><span class="modal-value highlight">🌑 ${solarEclipse.type}型 ${solarEclipse.time}</span></div>`;
    if (lunarEclipse) eclipseHtml += `<div class="modal-row"><span class="modal-label">月食</span><span class="modal-value highlight">🌕 ${lunarEclipse.type}型 ${lunarEclipse.time}</span></div>`;

    let julianHtml = '';
    const jdInt = Math.floor(dayInfo.jd + 0.5);
    if (jdInt < 2299161) { // Before Oct 15, 1582
        const julian = jdToJulianCalendar(jdInt);
        julianHtml = `<div class="modal-row"><span class="modal-label">儒略历</span><span class="modal-value" style="color: rgba(255,255,255,0.6);">${julian.year}年${julian.month}月${julian.day}日</span></div>`;
    }

    body.innerHTML = `<div class="modal-row"><span class="modal-label">公历</span><span class="modal-value">${gregorianStr}</span></div>
        ${julianHtml}
        <div class="modal-row"><span class="modal-label">农历</span><span class="modal-value highlight">${lunarStr}</span></div>
        <div class="modal-row"><span class="modal-label">干支</span><span class="modal-value">${ganzhiStr}</span></div>
        ${eclipseHtml}`;
    modal.classList.add('active');
}

function closeModal() { document.getElementById('day-modal').classList.remove('active'); }
