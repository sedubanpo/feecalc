// UI adapters around the calculator's existing calculation engine.
// Registry and notes are session-only; no student information enters localStorage.
let studentRegistry = [], registryState = 'idle', matchedStudentId = '', registryRequest = 0;
let legacyRecordMemo = '';
let studentNameComposing = false;
const LESSON_TYPES = ['개별정규', '1:1', '2:1', '3:1', '4:1', '특강', '컨설팅', '수행평가', '기타'];
let rateLibrary = [], rateLibraryDirty = false, rateLibraryPending = false;
const normalizeName = value => String(value || '').normalize('NFC').trim();
function matchedStudent() {
    return registryState === 'ready' && !studentNameComposing ? studentRegistry.find(s => s.id === matchedStudentId && normalizeName(s.name) === normalizeName(getCurrentStudentName())) || null : null;
}
function beginStudentNameComposition() { studentNameComposing = true; memoWidgetToken++; clearTimeout(memoWidgetTimer); renderStudentMemoWidget('', []); updateServerSaveModeUi(); }
function syncStudentMatch(showOptions = true) {
    const name = normalizeName(getCurrentStudentName());
    const exact = studentRegistry.filter(s => normalizeName(s.name) === name);
    if (!matchedStudent()) matchedStudentId = registryState === 'ready' && exact.length === 1 ? exact[0].id : '';
    const match = matchedStudent();
    if (match && document.getElementById('serverRecordStatus')?.textContent.includes('임시 학생')) setServerRecordStatus('등록 학생과 연결되었습니다. 서버에 저장할 수 있습니다.', 'info');
    const status = document.getElementById('studentMatchStatus');
    status.textContent = registryState === 'loading' ? '학생 명부 확인 중 · 입력 내용은 유지됩니다.' : match ? `등록 학생 연결됨 · ${match.school || '학교 미등록'} ${match.grade || ''}` : registryState === 'error' ? '명부 조회 실패 · 임시 계산만 가능합니다. 명부를 다시 불러와 주세요.' : !name ? '학생을 검색해 선택하세요. 미등록 이름으로도 임시 계산할 수 있습니다.' : exact.length > 1 ? '동명이인입니다. 학교·학년을 확인해 선택하세요. 선택 전에는 저장되지 않습니다.' : '임시 학생 · 계산과 이미지 저장만 가능하며 서버에는 저장되지 않습니다.';
    const options = document.getElementById('studentMatches');
    if (showOptions || match || !name || registryState !== 'ready') options.replaceChildren();
    if (showOptions && name && !match && registryState === 'ready') {
        studentRegistry.filter(s => normalizeName(s.name).includes(name)).slice(0, 12).forEach(s => {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'student-option';
            button.textContent = `${s.name} · ${s.school || '학교 미등록'} ${s.grade || ''}`;
            button.onclick = () => { matchedStudentId = s.id; document.getElementById('studentName').value = s.name; handleStudentNameInput(); };
            options.append(button);
        });
    }
    updateServerSaveModeUi();
    return match;
}
async function loadStudentRegistry() {
    const request = ++registryRequest, epoch = staffAuthEpoch;
    studentRegistry = []; registryState = isServerConfigured() ? 'loading' : 'idle'; syncStudentMatch();
    if (!isServerConfigured()) return;
    const {data, error} = await getSupabaseClient().rpc('feecalc_students', {});
    if (request !== registryRequest || epoch !== staffAuthEpoch) return;
    registryState = error || !Array.isArray(data) ? 'error' : 'ready';
    studentRegistry = registryState === 'ready' ? data : [];
    syncStudentMatch(); scheduleStudentMemoWidgetRefresh(0);
}
const originalStudentNameInput = handleStudentNameInput;
handleStudentNameInput = function() {
    if (studentNameComposing) return;
    syncStudentMatch(); renderStudentMemoWidget('', []); memoWidgetToken++;
    originalStudentNameInput();
};
const originalAuthState = handleStaffAuthState;
handleStaffAuthState = async function(event) {
    registryRequest++; registryState = 'idle'; studentRegistry = []; matchedStudentId = ''; syncStudentMatch(false);
    await originalAuthState(event);
    if (event.state === 'ready' && isServerConfigured()) {
        await Promise.all([loadStudentRegistry(), hydrateSharedSettingsFromServerConfig()]);
    }
};
const originalSaveMode = updateServerSaveModeUi;
updateServerSaveModeUi = function() {
    originalSaveMode();
    document.querySelectorAll('[onclick^="saveServerRecord("]').forEach(button => {
        button.disabled = !isServerConfigured() || serverSavePending || !matchedStudent() || (button.id === 'serverUpdateButton' && !currentLoadedRecordId);
        if (!matchedStudent()) button.title = '계정 관리의 학생과 연결한 뒤 저장할 수 있습니다.';
    });
};
const originalSaveRecord = saveServerRecord;
saveServerRecord = async function(mode) {
    if (!syncStudentMatch(false)) { setServerRecordStatus('임시 학생은 서버에 저장되지 않습니다. 등록 학생을 선택해 주세요.', 'warning'); return; }
    return originalSaveRecord(mode);
};
getCurrentRecordMemo = function() { return legacyRecordMemo; };
const originalCollectState = collectCalculatorState;
collectCalculatorState = function() {
    const state = originalCollectState();
    state.studentName = matchedStudent()?.name || getCurrentStudentName(); state.studentId = matchedStudent()?.id || '';
    return state;
};
const originalApplyState = applyCalculatorState;
applyCalculatorState = function(data, ...args) {
    const result = originalApplyState(data, ...args);
    legacyRecordMemo = String(data.recordMemo || data.memo || '');
    matchedStudentId = typeof data.studentId === 'string' ? data.studentId : '';
    syncStudentMatch(); renderStudentMemoWidget('', []); scheduleStudentMemoWidgetRefresh(0);
    return result;
};
const originalClearMonthly = clearMonthlyState;
clearMonthlyState = function(...args) { legacyRecordMemo = ''; return originalClearMonthly(...args); };
refreshStudentMemoWidget = async function() {
    if (studentNameComposing) return;
    const token = ++memoWidgetToken, epoch = staffAuthEpoch;
    const student = syncStudentMatch(false);
    if (!student || !isServerConfigured()) { renderStudentMemoWidget('', []); return; }
    const widget = document.getElementById('studentMemoWidget'), body = document.getElementById('studentMemoWidgetBody');
    widget.classList.remove('hidden'); document.getElementById('studentMemoWidgetName').textContent = student.name + ' · 데스크 포털 원본';
    document.getElementById('studentMemoWidgetCount').textContent = '';
    body.textContent = '수강료 메모를 확인하고 있습니다.';
    const {data, error} = await getSupabaseClient().rpc('feecalc_student_memos', {p_student_id: student.id});
    if (token !== memoWidgetToken || epoch !== staffAuthEpoch || student.id !== matchedStudent()?.id) return;
    body.replaceChildren();
    const items = Array.isArray(data) ? data : [];
    document.getElementById('studentMemoWidgetCount').textContent = error ? '조회 실패' : `${items.length}건`;
    const message = document.createElement('p'); message.className = 'ui-help';
    message.textContent = error ? error.message : items.length ? '메모 작성·수정은 데스크 포털에서 해 주세요.' : '등록된 수강료 메모가 없습니다.';
    body.append(message);
    const portal = document.createElement('a'); portal.href = 'https://sedubanpo.github.io/desk-portal/'; portal.target = '_blank'; portal.rel = 'noopener'; portal.textContent = '데스크 포털 열기'; portal.className = 'ui-help'; portal.style.textDecoration = 'underline'; body.append(portal);
    for (const item of items) {
        const section = document.createElement('div'); section.className = 'desk-memo';
        const meta = document.createElement('p'); meta.className = 'ui-help'; meta.textContent = [item.createdAt?.slice(0, 10), item.author].filter(Boolean).join(' · ');
        const content = document.createElement('p'); content.textContent = item.memo; section.append(meta, content); body.append(section);
    }
    const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'ui-button'; retry.textContent = '메모 새로고침'; retry.onclick = () => scheduleStudentMemoWidgetRefresh(0); body.append(retry);
};

function normalizeRateLibrary(items) {
    if (!Array.isArray(items)) return [];
    const seen = new Set();
    return items.filter(item => item && LESSON_TYPES.includes(item.type) && ['perClass','perHour'].includes(item.unit) && Number.isSafeInteger(item.amount) && item.amount > 0).filter(item => { const key = `${item.type}|${item.unit}|${item.amount}`; if (seen.has(key)) return false; seen.add(key); return true; }).map(({type,unit,amount}) => ({type,unit,amount}));
}
function legacyRates(values) { return (values || []).map(amount => ({type:'기타', unit:'perClass', amount:Number(amount)})); }
hydratePricePresets = function() {
    rateLibrary = normalizeRateLibrary(legacyRates(DEFAULT_PRICE_PRESETS)); renderPricePresetPanel();
};
const originalSharedSettings = applySharedSettingsFromPayload;
applySharedSettingsFromPayload = function(payload = {}) {
    const result = originalSharedSettings(payload);
    if (!rateLibraryDirty) {
        if (Array.isArray(payload.rateLibrary)) rateLibrary = normalizeRateLibrary(payload.rateLibrary);
        else if (Array.isArray(payload.pricePresets)) rateLibrary = normalizeRateLibrary(legacyRates(payload.pricePresets));
        renderPricePresetPanel();
    }
    return result || Array.isArray(payload.rateLibrary);
};
const originalSharedCollect = collectSharedAppSettings;
collectSharedAppSettings = function() { return {...originalSharedCollect(), pricePresets:[...new Set(rateLibrary.map(item => item.amount))], rateLibrary: normalizeRateLibrary(rateLibrary)}; };
function priceStatus(text) { document.getElementById('priceLibraryStatus').textContent = text; }
renderPricePresetPanel = function() {
    const summary = document.getElementById('pricePresetSummary');
    summary.innerHTML = LESSON_TYPES.map(type => {
        const rows = rateLibrary.filter(item => item.type === type);
        return `<div class="price-group"><strong>${type}</strong><span>${rows.length ? rows.map(item => `${formatPresetAmount(item.amount)}원 <small>${item.unit === 'perHour' ? '시간당' : '회당'}</small>`).join(' / ') : '<small>등록된 단가 없음</small>'}</span></div>`;
    }).join('');
    document.getElementById('pricePresetList').innerHTML = rateLibrary.map((item,index) => `<div class="price-group"><span>${item.type} · ${item.unit === 'perHour' ? '시간당' : '회당'} ${formatPresetAmount(item.amount)}원</span><button type="button" class="ui-button" aria-label="${item.type} ${item.amount}원 삭제" onclick="removePricePreset(${index})">삭제</button></div>`).join('');
    const type = document.getElementById('pricePresetType'); if (!type.options.length) type.innerHTML = LESSON_TYPES.map(t => `<option>${t}</option>`).join('');
    refreshRatePresetRows();
};
buildRatePresetButtons = function() {
    return `<select class="row-price-type" aria-label="단가 수업 유형" onchange="filterRowPrices(this)"><option value="">유형별 단가 선택</option>${LESSON_TYPES.map(type=>`<option>${type}</option>`).join('')}</select><select class="row-price-value" aria-label="저장된 단가" onchange="selectRowPrice(this)" disabled><option value="">유형을 먼저 선택하세요</option></select>`;
};
function filterRowPrices(select) {
    const values = select.parentElement.querySelector('.row-price-value');
    const isEstimate = !!select.closest('.guide-estimate-row');
    const matches = rateLibrary.map((item,index)=>({...item,index})).filter(item=>item.type===select.value && (!isEstimate || item.unit === 'perClass'));
    values.innerHTML = '<option value="">단가 선택</option>' + matches.map(item=>`<option value="${item.index}">${formatPresetAmount(item.amount)}원 · ${item.unit==='perHour'?'시간당':'회당'}</option>`).join('');
    values.disabled = !matches.length;
    if (!matches.length) values.innerHTML = '<option value="">등록된 단가 없음 · 직접 입력</option>';
}
function selectRowPrice(select) {
    if (select.value === '') return;
    const rate = rateLibrary[Number(select.value)]; if (!rate) return;
    const row = select.closest('.auto-row, .select-row, .manual-row, .guide-estimate-row, .first-reg-row, .timetable-row');
    const unit = row?.querySelector('.rate-mode'); if (unit) unit.value = rate.unit;
    if (row?.classList.contains('timetable-row') && ttData[Number(row.dataset.index)]) ttData[Number(row.dataset.index)].rateMode = rate.unit;
    applyRatePreset(select, rate.amount);
}
addPricePreset = function() {
    if (rateLibraryPending) return;
    const amount = Number(document.getElementById('pricePresetInput').value);
    if (!Number.isSafeInteger(amount) || amount <= 0) { priceStatus('금액을 1원 이상의 정수로 입력해 주세요.'); return; }
    rateLibrary = normalizeRateLibrary([...rateLibrary, {type:document.getElementById('pricePresetType').value, unit:document.getElementById('pricePresetUnit').value, amount}]);
    rateLibraryDirty = true; renderPricePresetPanel(); priceStatus('변경사항이 아직 서버에 저장되지 않았습니다.');
};
removePricePreset = function(index) { if (rateLibraryPending) return; rateLibrary.splice(index,1); rateLibraryDirty = true; renderPricePresetPanel(); priceStatus('변경사항이 아직 서버에 저장되지 않았습니다.'); };
async function savePriceLibrary() {
    if (rateLibraryPending) return;
    if (!isServerConfigured()) { priceStatus('단가 서버 저장은 직원 로그인 후 가능합니다.'); return; }
    rateLibraryPending = true; const epoch = staffAuthEpoch;
    document.getElementById('savePriceLibrary').disabled = true; priceStatus('공통 단가를 저장하고 있습니다.');
    const result = await saveSharedAppSettingsToServer();
    rateLibraryPending = false; document.getElementById('savePriceLibrary').disabled = false;
    if (epoch !== staffAuthEpoch) return;
    if (result) rateLibraryDirty = false;
    priceStatus(result ? '서버 저장 완료 · 다른 직원도 같은 단가를 조회할 수 있습니다.' : '서버 저장을 확인하지 못했습니다. 입력값은 유지됩니다. 서버 단가를 조회해 확인해 주세요.');
}
async function reloadPriceLibrary() {
    if (rateLibraryPending) return;
    if (!isServerConfigured()) { priceStatus('직원 로그인 후 서버 단가를 조회할 수 있습니다.'); return; }
    if (rateLibraryDirty && !confirm('저장하지 않은 단가 변경을 버리고 서버 값을 불러올까요?')) return;
    const epoch = staffAuthEpoch; rateLibraryPending = true; priceStatus('서버 단가 조회 중입니다.');
    const {data,error} = await getSupabaseClient().rpc('feecalc_get_app_settings', {});
    rateLibraryPending = false; if (epoch !== staffAuthEpoch) return;
    if (error) { priceStatus('서버 조회 실패 · 현재 입력값은 유지됩니다. 다시 조회해 주세요.'); return; }
    rateLibraryDirty = false; applySharedSettingsFromPayload(data || {}); priceStatus('서버 단가 조회 완료');
}

function previousMonthLabel(kind) {
    const month = Number(document.getElementById('targetMonth').value);
    return `${month === 1 ? 12 : month - 1}월 ${kind === 'carry' ? '이월금' : '초과금'}`;
}
function adjustmentKindButtons(id, kind) {
    return `<div class="adjustment-kinds" role="group" aria-label="조정 유형">${[['carry','이월금'],['extra','초과금'],['other','기타']].map(([value,label])=>`<button type="button" class="ui-button" aria-pressed="${kind===value}" onclick="setAdjustmentKind('${id}','${value}')">${label}</button>`).join('')}</div>`;
}
normalizeAdjustmentItems = function(items = [], legacyAmount = 0) {
    const rows = (Array.isArray(items) ? items : []).map((item,index) => {
        const kind = ['carry','extra'].includes(item?.kind) ? item.kind : 'other', value = Number(item?.amount)||0;
        return {label:String(item?.label || item?.name || `조정 ${index+1}`), amount:kind === 'carry' ? -Math.abs(value) : kind === 'extra' ? Math.abs(value) : value, kind};
    });
    if (!rows.length && Number(legacyAmount)) rows.push({label:'이월/초과금 조정', amount:Number(legacyAmount), kind:'other'});
    return rows;
};
collectAdjustmentItems = function(includeBlank = false) {
    return [...document.querySelectorAll('#adjustmentList .adjustment-item')].map(row => ({label:row.querySelector('.adjustment-label').value.trim() || '기타 조정', amount:Number(row.querySelector('.adjustment-amount').value)||0, kind:row.dataset.kind || 'other'})).filter(item=>includeBlank || item.amount!==0);
};
addAdjustmentItem = function(label = '', amount = '', options = {}) {
    const id = `adjustment-${++adjustmentItemCounter}`, kind = options.kind || 'other';
    document.getElementById('adjustmentList').insertAdjacentHTML('beforeend', `<div id="${id}" class="adjustment-item" data-kind="${kind}">${adjustmentKindButtons(id,kind)}<div class="adjustment-fields"><input class="adjustment-label" aria-label="조정 내용" value="${escapeHtml(label)}" placeholder="조정 내용" oninput="handleAdjustmentInput()"><input type="number" class="adjustment-amount" aria-label="조정 금액 (원)" value="${amount === '' ? '' : Number(amount)||0}" placeholder="금액 (원)" oninput="normalizeAdjustmentSign(this)"><button type="button" class="ui-button" aria-label="이월·초과금 항목 삭제" onclick="removeAdjustmentItem('${id}')">삭제</button></div></div>`);
    if (!options.silent) handleAdjustmentInput();
};
setAdjustmentItems = function(items = [], legacyAmount = 0) {
    document.getElementById('adjustmentList').replaceChildren();
    normalizeAdjustmentItems(items,legacyAmount).forEach(item=>addAdjustmentItem(item.label,item.amount,{silent:true,kind:item.kind})); syncLegacyAdjustmentInput();
};
function setAdjustmentKind(id, kind) {
    const row = document.getElementById(id); row.dataset.kind = kind;
    row.querySelector('.adjustment-kinds').outerHTML = adjustmentKindButtons(id,kind);
    if (kind !== 'other') row.querySelector('.adjustment-label').value = previousMonthLabel(kind);
    normalizeAdjustmentSign(row.querySelector('.adjustment-amount'));
}
function normalizeAdjustmentSign(input) {
    const kind = input.closest('.adjustment-item').dataset.kind;
    if (input.value !== '' && kind !== 'other') input.value = (kind === 'carry' ? -1 : 1) * Math.abs(Number(input.value)||0);
    handleAdjustmentInput();
}
function addPaymentAdjustment(kind) {
    appendPaymentGridRow({type:'adjustment',name:kind==='other'?'기타 조정':previousMonthLabel(kind),amount:0}); renderPaymentReceipt();
}
const paymentTable = document.getElementById('paymentGridBody')?.closest('table');
if (paymentTable) {
    const bar = document.createElement('div'); bar.className='price-actions';
    bar.innerHTML = '<span class="ui-help">조정 추가</span>' + [['carry','이월금'],['extra','초과금'],['other','기타']].map(([kind,label])=>`<button type="button" class="ui-button" onclick="addPaymentAdjustment('${kind}')">${label}</button>`).join('');
    paymentTable.before(bar);
}
