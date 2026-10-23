/* ============================================================
   Przelicznik - frontend
   Vanilla JS organized into namespaces. Dispatched per page.
   ============================================================ */

(function () {
    'use strict';

    // ============================================================
    // Storage layer
    // ============================================================

    const Storage = {
        keys: {
            theme: 'przelicznik_theme',
            profiles: 'przelicznik_profiles_v2',
            activeProfile: 'przelicznik_active_profile_v2',
            wishlist: 'przelicznik_wishlist',
            goals: 'przelicznik_goals',
            history: 'przelicznik_history',
        },

        get(key, fallback) {
            try {
                const raw = localStorage.getItem(key);
                return raw === null ? fallback : JSON.parse(raw);
            } catch {
                return fallback;
            }
        },

        set(key, value) {
            localStorage.setItem(key, JSON.stringify(value));
        },

        remove(key) {
            localStorage.removeItem(key);
        },
    };

    // ============================================================
    // Formatting helpers
    // ============================================================

    const fmt = {
        money(n) {
            return Number(n).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
        },
        num(n, digits = 2) {
            return Number(n).toLocaleString('pl-PL', { minimumFractionDigits: digits, maximumFractionDigits: digits });
        },
        int(n) {
            return Number(n).toLocaleString('pl-PL', { maximumFractionDigits: 2 });
        },
        date(ts) {
            const d = new Date(ts);
            return d.toLocaleDateString('pl-PL') + ' ' + d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
        },
        escapeHtml(s) {
            return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        },
    };

    function pluralPl(n, one, few, many) {
        if (n === 1) return one;
        const r10 = n % 10, r100 = n % 100;
        if (r10 >= 2 && r10 <= 4 && !(r100 >= 12 && r100 <= 14)) return few;
        return many;
    }

    function $(id) { return document.getElementById(id); }

    // ============================================================
    // Toast notifications
    // ============================================================

    const Toast = {
        show(message, type = 'info', duration = 4000) {
            const container = $('toast-container');
            if (!container) return;
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.textContent = message;
            container.appendChild(toast);
            setTimeout(() => {
                toast.classList.add('removing');
                setTimeout(() => toast.remove(), 200);
            }, duration);
        },
        success(msg) { this.show(msg, 'success'); },
        error(msg) { this.show(msg, 'error', 5000); },
        warning(msg) { this.show(msg, 'warning'); },
        info(msg) { this.show(msg, 'info'); },
    };

    // ============================================================
    // Theme
    // ============================================================

    const Theme = {
        init() {
            const toggle = $('theme-toggle');
            if (!toggle) return;
            this.updateIcons();
            toggle.addEventListener('click', () => this.toggle());
        },
        get() {
            return document.documentElement.getAttribute('data-theme') || 'light';
        },
        set(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            Storage.set(Storage.keys.theme, theme);
            this.updateIcons();
        },
        toggle() {
            this.set(this.get() === 'dark' ? 'light' : 'dark');
        },
        updateIcons() {
            const sun = document.querySelector('.icon-sun');
            const moon = document.querySelector('.icon-moon');
            if (!sun || !moon) return;
            const isDark = this.get() === 'dark';
            sun.classList.toggle('hidden', isDark);
            moon.classList.toggle('hidden', !isDark);
        },
    };

    // ============================================================
    // Navbar
    // ============================================================

    const Navbar = {
        init() {
            const toggle = $('navbar-toggle');
            const menu = $('navbar-menu');
            if (toggle && menu) toggle.addEventListener('click', () => menu.classList.toggle('open'));
        },
    };

    // ============================================================
    // Profiles - multiple profiles management
    // ============================================================

    const Profiles = {
        list() {
            return Storage.get(Storage.keys.profiles, []);
        },
        activeId() {
            return Storage.get(Storage.keys.activeProfile, null);
        },
        active() {
            const id = this.activeId();
            if (!id) return null;
            return this.list().find(p => p.id === id) || null;
        },
        save(profile) {
            const list = this.list();
            const idx = list.findIndex(p => p.id === profile.id);
            if (idx >= 0) list[idx] = profile;
            else list.push(profile);
            Storage.set(Storage.keys.profiles, list);
            if (list.length === 1 || !this.activeId()) this.setActive(profile.id);
        },
        delete(id) {
            const list = this.list().filter(p => p.id !== id);
            Storage.set(Storage.keys.profiles, list);
            if (this.activeId() === id) {
                Storage.set(Storage.keys.activeProfile, list[0]?.id || null);
            }
        },
        setActive(id) {
            Storage.set(Storage.keys.activeProfile, id);
        },
        newId() {
            return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
        },
    };

    // ============================================================
    // API client
    // ============================================================

    const API = {
        async post(path, payload) {
            const res = await fetch(path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Błąd serwera');
            return data;
        },
        calculate(payload) { return this.post('/api/calculate', payload); },
        reverse(payload) { return this.post('/api/reverse', payload); },
        profilePreview(payload) { return this.post('/api/profile-preview', payload); },
        whatif(payload) { return this.post('/api/whatif', payload); },
    };

    // ============================================================
    // Profile banner (visible on all non-settings pages)
    // ============================================================

    const ProfileBanner = {
        render() {
            const banner = $('profile-banner');
            if (!banner) return;
            const profile = Profiles.active();
            if (!profile) {
                banner.classList.remove('hidden');
                banner.classList.add('warning');
                banner.innerHTML = `
                    <div><strong>⚠ Brak profilu zarobków.</strong> Skonfiguruj go w sekcji <a href="/settings">Profil</a>.</div>
                `;
                return;
            }
            banner.classList.remove('hidden', 'warning');
            const rateInfo = profile.mode === 'hourly'
                ? `${fmt.num(profile.hourly_rate)} zł/h`
                : `${fmt.num(profile.monthly_salary)} zł/m-c`;
            const grossInfo = profile.is_brutto ? 'brutto' : 'netto';
            banner.innerHTML = `
                <div class="profile-info">
                    <strong>${fmt.escapeHtml(profile.name || formLabel(profile))}</strong>
                    <span class="profile-chip">${fmt.escapeHtml(formLabel(profile))}</span>
                    <span class="profile-chip">${rateInfo} ${grossInfo}</span>
                    <span class="profile-chip">${profile.hours_per_month} h/m-c</span>
                </div>
                <a href="/settings" class="btn-link">edytuj</a>
            `;
        },
    };

    function formLabel(p) {
        const map = {
            uop: 'Umowa o pracę',
            uz: p.uz_student ? 'UZ (student)' : 'Umowa zlecenie',
            b2b_liniowy: 'B2B liniowy 19%',
            b2b_ryczalt: `B2B ryczałt ${p.ryczalt_rate || 12}%`,
            b2b_skala: 'B2B skala 12/32%',
        };
        return map[p.form] || p.form;
    }

    // ============================================================
    // Pages
    // ============================================================

    const Pages = {};

    // ---------- Calculator ----------

    Pages.calculator = function () {
        let lastResult = null;

        // Pre-fill from URL params (sharing)
        const params = new URLSearchParams(location.search);
        if (params.get('price')) $('price').value = params.get('price');
        if (params.get('name')) $('product_name').value = params.get('name');

        $('btn-calc').addEventListener('click', runCalc);
        $('price').addEventListener('keypress', e => { if (e.key === 'Enter') runCalc(); });

        $('btn-add-wishlist').addEventListener('click', () => {
            const price = parseFloat($('price').value);
            const name = $('product_name').value.trim() || 'Bez nazwy';
            if (!price || price <= 0) { Toast.warning('Podaj cenę produktu.'); return; }
            const list = Storage.get(Storage.keys.wishlist, []);
            list.push({ id: 'w_' + Date.now(), name, price });
            Storage.set(Storage.keys.wishlist, list);
            Toast.success(`Dodano „${name}” do listy zakupów`);
        });

        $('btn-add-goal').addEventListener('click', () => {
            const price = parseFloat($('price').value);
            const name = $('product_name').value.trim() || 'Bez nazwy';
            if (!price || price <= 0) { Toast.warning('Podaj cenę produktu.'); return; }
            const list = Storage.get(Storage.keys.goals, []);
            list.push({ id: 'g_' + Date.now(), name, price, monthly: 0, saved: 0, created: Date.now() });
            Storage.set(Storage.keys.goals, list);
            Toast.success(`Cel „${name}” dodany — uzupełnij plan w sekcji Cele`);
        });

        $('btn-share').addEventListener('click', () => {
            const price = parseFloat($('price').value);
            const name = $('product_name').value.trim();
            if (!price) { Toast.warning('Najpierw wpisz cenę.'); return; }
            const url = new URL(location.href);
            url.searchParams.set('price', price);
            if (name) url.searchParams.set('name', name);
            navigator.clipboard.writeText(url.toString())
                .then(() => Toast.success('Link skopiowany do schowka'))
                .catch(() => Toast.error('Nie udało się skopiować'));
        });

        async function runCalc() {
            const profile = Profiles.active();
            if (!profile) { Toast.error('Najpierw skonfiguruj profil zarobków.'); return; }
            let price = parseFloat($('price').value);
            if (!price || price <= 0) { Toast.warning('Podaj cenę produktu.'); return; }

            // Inflation
            const applyInflation = $('apply_inflation').checked;
            let adjustedPrice = price;
            if (applyInflation) {
                const years = parseFloat($('inflation_years').value) || 0;
                const pct = parseFloat($('inflation_pct').value) || 0;
                adjustedPrice = price * Math.pow(1 + pct / 100, years);
            }

            try {
                const data = await API.calculate({ ...profile, price: adjustedPrice });
                lastResult = data;
                renderResult(data, $('product_name').value.trim(), applyInflation, price);
                History.add({
                    product: $('product_name').value.trim() || 'Bez nazwy',
                    price: data.price,
                    breakdown_text: data.breakdown_text,
                    form_label: data.form_label,
                    timestamp: Date.now(),
                });
            } catch (err) {
                Toast.error(err.message);
            }
        }

        function renderResult(data, name, inflated, originalPrice) {
            const priceNote = inflated
                ? ` (cena uwzgl. inflacji ${fmt.money(data.price)}; dziś: ${fmt.money(originalPrice)})`
                : '';
            const prefix = name
                ? `Aby kupić „${name}”${priceNote}\nmusisz pracować:\n\n`
                : `Aby zarobić ${fmt.money(data.price)} musisz pracować:\n\n`;
            $('big-result').textContent = prefix + data.breakdown_text;

            $('total-hours').textContent = fmt.int(data.total_hours) + ' h';
            $('total-days').textContent = fmt.int(data.total_working_days);
            $('total-weeks').textContent = fmt.int(data.total_working_weeks);
            $('total-months').textContent = fmt.int(data.total_working_months);
            $('total-years').textContent = fmt.int(data.total_working_years);

            const perc = data.percent_of_year;
            let percLabel;
            if (perc < 1) percLabel = 'To <strong>mniej niż 1%</strong> twojego rocznego czasu pracy.';
            else if (perc < 100) percLabel = `To <strong>${fmt.int(perc)}%</strong> twojego rocznego czasu pracy.`;
            else percLabel = `To <strong>${fmt.int(perc)}%</strong> rocznego czasu pracy — ponad cały rok!`;

            $('percent-box').innerHTML = `
                ${percLabel}<br>
                <small>${data.working_days_per_year} dni roboczych w roku (252 − ${data.vacation_days} urlopu) = ${fmt.int(data.hours_per_year_effective)} h</small>
            `;

            const rows = [
                ['Forma zatrudnienia', fmt.escapeHtml(data.form_label)],
                ['Cena produktu', fmt.money(data.price)],
                ['Efektywna stawka netto', fmt.money(data.effective_hourly_netto) + '/h'],
                ['Pensja netto / m-c', fmt.money(data.monthly_netto)],
            ];
            if (data.monthly_gross) rows.push(['Pensja brutto / m-c', fmt.money(data.monthly_gross)]);

            $('meta-box').innerHTML = rows.map(([k, v]) => `<div><strong>${k}</strong><span>${v}</span></div>`).join('');

            $('result').classList.remove('hidden');
            $('result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    };

    // ---------- Reverse ----------

    Pages.reverse = function () {
        $('btn-reverse').addEventListener('click', async () => {
            const profile = Profiles.active();
            if (!profile) { Toast.error('Najpierw skonfiguruj profil.'); return; }
            const amount = parseFloat($('rev_amount').value);
            const unit = $('rev_unit').value;
            if (!amount || amount <= 0) { Toast.warning('Podaj czas > 0.'); return; }

            try {
                const data = await API.reverse({ ...profile, amount, unit });
                const unitLabel = $('rev_unit').selectedOptions[0].textContent;
                $('reverse-big-result').textContent = `W ${amount} ${unitLabel} zarobisz ${fmt.money(data.earned)} na rękę`;
                $('reverse-meta').innerHTML = [
                    ['Forma', fmt.escapeHtml(data.form_label)],
                    ['Stawka netto', fmt.money(data.effective_hourly_netto) + '/h'],
                    ['Łącznie godzin', fmt.int(data.hours) + ' h'],
                    ['Pensja netto / m-c', fmt.money(data.monthly_netto)],
                ].map(([k, v]) => `<div><strong>${k}</strong><span>${v}</span></div>`).join('');
                $('reverse-result').classList.remove('hidden');
            } catch (err) {
                Toast.error(err.message);
            }
        });
    };

    // ---------- Wishlist ----------

    Pages.wishlist = async function () {
        await renderWishlist();
        $('btn-clear-wishlist').addEventListener('click', () => {
            if (confirm('Wyczyścić całą listę zakupów?')) {
                Storage.set(Storage.keys.wishlist, []);
                renderWishlist();
            }
        });
    };

    async function renderWishlist() {
        const list = Storage.get(Storage.keys.wishlist, []);
        const tbody = $('wishlist-body');
        tbody.innerHTML = '';

        $('btn-clear-wishlist').classList.toggle('hidden', list.length === 0);

        if (list.length === 0) {
            $('wishlist-empty').classList.remove('hidden');
            $('wishlist-table').classList.add('hidden');
            return;
        }
        $('wishlist-empty').classList.add('hidden');
        $('wishlist-table').classList.remove('hidden');

        const profile = Profiles.active();
        if (!profile) {
            tbody.innerHTML = `<tr><td colspan="5" style="color:var(--color-danger);text-align:center;">Skonfiguruj profil zarobków, by widzieć czas pracy.</td></tr>`;
            return;
        }

        let totalPrice = 0, totalHours = 0, totalPercent = 0, hoursPerYear = null;

        for (const item of list) {
            try {
                const data = await API.calculate({ ...profile, price: item.price });
                totalPrice += data.price;
                totalHours += data.total_hours;
                totalPercent += data.percent_of_year;
                hoursPerYear = data.hours_per_year_effective;

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${fmt.escapeHtml(item.name)}</td>
                    <td>${fmt.money(data.price)}</td>
                    <td>${fmt.escapeHtml(data.breakdown_text)}</td>
                    <td>${fmt.int(data.percent_of_year)}%</td>
                    <td><button class="btn-link btn-link-danger" data-remove="${item.id}" title="Usuń">✕</button></td>
                `;
                tbody.appendChild(row);
            } catch (err) {
                const row = document.createElement('tr');
                row.innerHTML = `<td>${fmt.escapeHtml(item.name)}</td><td colspan="3" style="color:var(--color-danger)">${fmt.escapeHtml(err.message)}</td><td><button class="btn-link btn-link-danger" data-remove="${item.id}">✕</button></td>`;
                tbody.appendChild(row);
            }
        }

        $('wishlist-total-price').textContent = fmt.money(totalPrice);
        $('wishlist-total-percent').textContent = fmt.int(totalPercent) + '%';
        $('wishlist-total-time').textContent = hoursPerYear ? formatHoursBreakdown(totalHours, hoursPerYear) : '—';

        tbody.querySelectorAll('[data-remove]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.remove;
                const list = Storage.get(Storage.keys.wishlist, []).filter(x => x.id !== id);
                Storage.set(Storage.keys.wishlist, list);
                renderWishlist();
            });
        });
    }

    function formatHoursBreakdown(hours, hoursPerYear) {
        const HD = 8, HW = 40, HM = 168;
        let h = hours;
        const years = Math.floor(h / hoursPerYear); h -= years * hoursPerYear;
        const months = Math.floor(h / HM); h -= months * HM;
        const weeks = Math.floor(h / HW); h -= weeks * HW;
        const days = Math.floor(h / HD); h -= days * HD;
        const fullH = Math.floor(h);
        const mins = Math.round((h - fullH) * 60);
        const parts = [];
        if (years) parts.push(`${years} ${pluralPl(years, 'rok', 'lata', 'lat')}`);
        if (months) parts.push(`${months} ${pluralPl(months, 'miesiąc', 'miesiące', 'miesięcy')}`);
        if (weeks) parts.push(`${weeks} ${pluralPl(weeks, 'tydzień', 'tygodnie', 'tygodni')}`);
        if (days) parts.push(`${days} ${pluralPl(days, 'dzień', 'dni', 'dni')}`);
        if (fullH) parts.push(`${fullH} h`);
        if (mins) parts.push(`${mins} min`);
        return parts.join(', ') || '0 min';
    }

    // ---------- Goals ----------

    Pages.goals = function () {
        $('btn-add-goal').addEventListener('click', () => {
            const name = $('goal_name').value.trim();
            const price = parseFloat($('goal_price').value);
            const monthly = parseFloat($('goal_monthly').value) || 0;
            const saved = parseFloat($('goal_saved').value) || 0;

            if (!name) { Toast.warning('Podaj nazwę celu.'); return; }
            if (!price || price <= 0) { Toast.warning('Podaj cenę.'); return; }

            const goals = Storage.get(Storage.keys.goals, []);
            goals.push({ id: 'g_' + Date.now(), name, price, monthly, saved, created: Date.now() });
            Storage.set(Storage.keys.goals, goals);

            $('goal_name').value = '';
            $('goal_price').value = '';
            $('goal_monthly').value = '';
            $('goal_saved').value = '0';
            Toast.success('Cel dodany');
            renderGoals();
        });

        $('btn-clear-goals').addEventListener('click', () => {
            if (confirm('Usunąć wszystkie cele?')) {
                Storage.set(Storage.keys.goals, []);
                renderGoals();
            }
        });

        renderGoals();
    };

    function renderGoals() {
        const goals = Storage.get(Storage.keys.goals, []);
        const list = $('goals-list');
        list.innerHTML = '';
        $('btn-clear-goals').classList.toggle('hidden', goals.length === 0);

        if (goals.length === 0) {
            $('goals-empty').classList.remove('hidden');
            return;
        }
        $('goals-empty').classList.add('hidden');

        goals.forEach(goal => {
            const progress = Math.min(100, (goal.saved / goal.price) * 100);
            const remaining = Math.max(0, goal.price - goal.saved);
            const monthsLeft = goal.monthly > 0 ? Math.ceil(remaining / goal.monthly) : null;
            const eta = monthsLeft !== null && monthsLeft > 0
                ? new Date(Date.now() + monthsLeft * 30.44 * 86400 * 1000).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })
                : (progress >= 100 ? 'Osiągnięty 🎉' : 'Brak planu odkładania');

            const card = document.createElement('div');
            card.className = 'goal-card';
            card.innerHTML = `
                <div class="goal-card-header">
                    <div>
                        <div class="goal-name">${fmt.escapeHtml(goal.name)}</div>
                        <div class="goal-meta">${fmt.money(goal.saved)} / ${fmt.money(goal.price)} · ${goal.monthly > 0 ? 'odkładasz ' + fmt.money(goal.monthly) + '/m-c' : 'brak planu odkładania'}</div>
                    </div>
                    <div class="actions">
                        <button class="btn btn-secondary" data-edit="${goal.id}">Edytuj</button>
                        <button class="btn btn-danger btn-icon-only" data-remove="${goal.id}" title="Usuń">✕</button>
                    </div>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
                <div class="goal-status">
                    <span>${fmt.int(progress)}% zebrane · pozostało ${fmt.money(remaining)}</span>
                    <span class="goal-eta">${monthsLeft !== null && monthsLeft > 0 ? `${monthsLeft} ${pluralPl(monthsLeft, 'miesiąc', 'miesiące', 'miesięcy')} · ${eta}` : eta}</span>
                </div>
            `;
            list.appendChild(card);
        });

        list.querySelectorAll('[data-remove]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.remove;
                const goals = Storage.get(Storage.keys.goals, []).filter(g => g.id !== id);
                Storage.set(Storage.keys.goals, goals);
                renderGoals();
            });
        });

        list.querySelectorAll('[data-edit]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.edit;
                const goal = Storage.get(Storage.keys.goals, []).find(g => g.id === id);
                if (!goal) return;
                const newSaved = prompt('Ile już mam (zł)?', goal.saved);
                if (newSaved === null) return;
                const newMonthly = prompt('Odkładam miesięcznie (zł)?', goal.monthly);
                if (newMonthly === null) return;
                goal.saved = parseFloat(newSaved) || 0;
                goal.monthly = parseFloat(newMonthly) || 0;
                const goals = Storage.get(Storage.keys.goals, []);
                Storage.set(Storage.keys.goals, goals.map(g => g.id === id ? goal : g));
                renderGoals();
            });
        });
    }

    // ---------- Reference catalog ----------

    const CATALOG = [
        { emoji: '☕', name: 'Kawa w kawiarni', price: 15, category: 'codzienne' },
        { emoji: '🥐', name: 'Śniadanie na mieście', price: 35, category: 'codzienne' },
        { emoji: '🍔', name: 'Obiad / lunch', price: 45, category: 'codzienne' },
        { emoji: '🍕', name: 'Pizza na wynos', price: 60, category: 'codzienne' },
        { emoji: '🚌', name: 'Bilet miesięczny MPK', price: 110, category: 'codzienne' },
        { emoji: '⛽', name: 'Bak paliwa (50 l)', price: 350, category: 'codzienne' },
        { emoji: '🛒', name: 'Cotygodniowe zakupy', price: 400, category: 'codzienne' },
        { emoji: '🎬', name: 'Bilet do kina', price: 30, category: 'rozrywka' },
        { emoji: '🎮', name: 'Gra AAA', price: 280, category: 'rozrywka' },
        { emoji: '📺', name: 'Netflix (rok)', price: 720, category: 'rozrywka' },
        { emoji: '🎧', name: 'Spotify Premium (rok)', price: 240, category: 'rozrywka' },
        { emoji: '🎟️', name: 'Koncert', price: 250, category: 'rozrywka' },
        { emoji: '🍻', name: 'Wieczór ze znajomymi', price: 120, category: 'rozrywka' },
        { emoji: '📱', name: 'iPhone 15 (128 GB)', price: 4299, category: 'elektronika' },
        { emoji: '💻', name: 'Laptop średniej klasy', price: 5000, category: 'elektronika' },
        { emoji: '🎧', name: 'AirPods Pro 2', price: 1099, category: 'elektronika' },
        { emoji: '⌚', name: 'Apple Watch', price: 1899, category: 'elektronika' },
        { emoji: '📺', name: 'Telewizor 55″ OLED', price: 4500, category: 'elektronika' },
        { emoji: '🎮', name: 'PlayStation 5', price: 2399, category: 'elektronika' },
        { emoji: '🚗', name: 'Używane auto', price: 35000, category: 'duze' },
        { emoji: '🚙', name: 'Nowe auto kompakt', price: 110000, category: 'duze' },
        { emoji: '🏖️', name: 'Wakacje all-inclusive', price: 6500, category: 'duze' },
        { emoji: '🏠', name: 'Wkład własny mieszkania', price: 80000, category: 'duze' },
        { emoji: '🏡', name: 'Mieszkanie 50 m² (PL)', price: 550000, category: 'duze' },
        { emoji: '💍', name: 'Pierścionek zaręczynowy', price: 5000, category: 'duze' },
        { emoji: '👶', name: 'Roczne koszty dziecka', price: 18000, category: 'duze' },
    ];

    Pages.reference = async function () {
        let activeCategory = 'all';

        document.querySelectorAll('.inline-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.inline-tab').forEach(t => t.classList.toggle('active', t === tab));
                activeCategory = tab.dataset.category;
                renderCatalog();
            });
        });

        async function renderCatalog() {
            const grid = $('catalog-grid');
            grid.innerHTML = '';
            const profile = Profiles.active();
            const items = activeCategory === 'all' ? CATALOG : CATALOG.filter(i => i.category === activeCategory);

            for (const item of items) {
                let timeText = '<span style="color:var(--color-text-muted)">— ustaw profil —</span>';
                if (profile) {
                    try {
                        const data = await API.calculate({ ...profile, price: item.price });
                        timeText = data.breakdown_text;
                    } catch { /* ignore */ }
                }
                const card = document.createElement('div');
                card.className = 'catalog-item';
                card.innerHTML = `
                    <div class="catalog-emoji">${item.emoji}</div>
                    <div class="catalog-name">${fmt.escapeHtml(item.name)}</div>
                    <div class="catalog-price">${fmt.money(item.price)}</div>
                    <div class="catalog-time">${timeText}</div>
                `;
                card.addEventListener('click', () => {
                    const list = Storage.get(Storage.keys.wishlist, []);
                    list.push({ id: 'w_' + Date.now(), name: item.name, price: item.price });
                    Storage.set(Storage.keys.wishlist, list);
                    Toast.success(`Dodano „${item.name}” do listy zakupów`);
                });
                grid.appendChild(card);
            }
        }

        renderCatalog();
    };

    // ---------- History ----------

    const History = {
        add(entry) {
            const list = Storage.get(Storage.keys.history, []);
            list.unshift(entry);
            if (list.length > 20) list.length = 20;
            Storage.set(Storage.keys.history, list);
        },
        all() { return Storage.get(Storage.keys.history, []); },
        clear() { Storage.remove(Storage.keys.history); },
    };

    Pages.history = function () {
        renderHistory();
        renderStats();
        $('btn-clear-history').addEventListener('click', () => {
            if (confirm('Wyczyścić historię?')) {
                History.clear();
                renderHistory();
                renderStats();
            }
        });
    };

    function renderHistory() {
        const list = History.all();
        const tbody = $('history-body');
        tbody.innerHTML = '';
        $('btn-clear-history').classList.toggle('hidden', list.length === 0);

        if (list.length === 0) {
            $('history-empty').classList.remove('hidden');
            $('history-table').classList.add('hidden');
            return;
        }
        $('history-empty').classList.add('hidden');
        $('history-table').classList.remove('hidden');

        list.forEach((entry, idx) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${fmt.date(entry.timestamp)}</td>
                <td>${fmt.escapeHtml(entry.product)}</td>
                <td>${fmt.money(entry.price)}</td>
                <td>${fmt.escapeHtml(entry.breakdown_text)}</td>
                <td>${fmt.escapeHtml(entry.form_label || '—')}</td>
                <td><button class="btn-link btn-link-danger" data-h="${idx}">✕</button></td>
            `;
            tbody.appendChild(row);
        });

        tbody.querySelectorAll('[data-h]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.h);
                const list = History.all();
                list.splice(idx, 1);
                Storage.set(Storage.keys.history, list);
                renderHistory();
                renderStats();
            });
        });
    }

    function renderStats() {
        const list = History.all();
        const grid = $('stats-grid');
        if (list.length === 0) {
            $('stats-section').classList.add('hidden');
            return;
        }
        $('stats-section').classList.remove('hidden');

        const totalSpent = list.reduce((s, e) => s + (e.price || 0), 0);
        const avg = totalSpent / list.length;
        const max = list.reduce((m, e) => e.price > m.price ? e : m, { price: 0 });

        grid.innerHTML = `
            <div class="stat-large">
                <div class="stat-label">Łączna suma cen</div>
                <div class="stat-value">${fmt.money(totalSpent)}</div>
            </div>
            <div class="stat-large">
                <div class="stat-label">Średnia cena</div>
                <div class="stat-value">${fmt.money(avg)}</div>
            </div>
            <div class="stat-large">
                <div class="stat-label">Najdroższe wyliczenie</div>
                <div class="stat-value" style="font-size:var(--text-lg)">${fmt.escapeHtml(max.product || '—')}<br><small style="color:var(--color-text-muted);font-weight:500">${fmt.money(max.price || 0)}</small></div>
            </div>
            <div class="stat-large">
                <div class="stat-label">Wyliczeń</div>
                <div class="stat-value">${list.length}</div>
            </div>
        `;
    }

    // ---------- Settings ----------

    let salaryChart = null;

    Pages.settings = function () {
        const formSelect = $('form');
        const modeRadios = document.querySelectorAll('input[name="mode"]');
        let editingId = null;

        function updateFormVisibility() {
            const f = formSelect.value;
            $('zus-variant-field').classList.toggle('hidden', !f.startsWith('b2b_'));
            $('ryczalt-rate-field').classList.toggle('hidden', f !== 'b2b_ryczalt');
            $('uz-options').classList.toggle('hidden', f !== 'uz');
        }
        function updateModeVisibility() {
            const mode = document.querySelector('input[name="mode"]:checked').value;
            $('hourly-fields').classList.toggle('hidden', mode !== 'hourly');
            $('monthly-fields').classList.toggle('hidden', mode !== 'monthly');
        }
        formSelect.addEventListener('change', updateFormVisibility);
        modeRadios.forEach(r => r.addEventListener('change', updateModeVisibility));

        function readForm() {
            const mode = document.querySelector('input[name="mode"]:checked').value;
            const profile = {
                id: editingId || Profiles.newId(),
                name: $('profile_name').value.trim() || 'Bez nazwy',
                form: formSelect.value,
                mode,
                is_brutto: $('is_brutto').checked,
                hours_per_month: parseFloat($('hours_per_month').value) || 168,
                vacation_days: parseInt($('vacation_days').value) || 0,
            };
            if (mode === 'hourly') profile.hourly_rate = parseFloat($('hourly_rate').value) || 0;
            else profile.monthly_salary = parseFloat($('monthly_salary').value) || 0;
            if (profile.form.startsWith('b2b_')) profile.zus_variant = $('zus_variant').value;
            if (profile.form === 'b2b_ryczalt') profile.ryczalt_rate = parseFloat($('ryczalt_rate').value) || 12;
            if (profile.form === 'uz') {
                profile.uz_student = $('uz_student').checked;
                profile.uz_chorobowe = $('uz_chorobowe').checked;
            }
            return profile;
        }

        function fillForm(profile) {
            editingId = profile.id;
            $('profile_name').value = profile.name || '';
            formSelect.value = profile.form || 'uop';
            if (profile.zus_variant) $('zus_variant').value = profile.zus_variant;
            if (profile.ryczalt_rate) $('ryczalt_rate').value = profile.ryczalt_rate;
            $('uz_student').checked = !!profile.uz_student;
            $('uz_chorobowe').checked = profile.uz_chorobowe !== undefined ? profile.uz_chorobowe : true;
            document.querySelector(`input[name="mode"][value="${profile.mode || 'hourly'}"]`).checked = true;
            $('hourly_rate').value = profile.hourly_rate || '';
            $('monthly_salary').value = profile.monthly_salary || '';
            $('hours_per_month').value = profile.hours_per_month || 168;
            $('vacation_days').value = profile.vacation_days ?? 26;
            $('is_brutto').checked = !!profile.is_brutto;
            updateFormVisibility();
            updateModeVisibility();
        }

        function resetForm() {
            editingId = null;
            $('profile_name').value = '';
            formSelect.value = 'uop';
            $('hourly_rate').value = '';
            $('monthly_salary').value = '';
            $('hours_per_month').value = 168;
            $('vacation_days').value = 26;
            $('is_brutto').checked = false;
            $('uz_student').checked = false;
            $('uz_chorobowe').checked = true;
            document.querySelector('input[name="mode"][value="hourly"]').checked = true;
            updateFormVisibility();
            updateModeVisibility();
        }

        function renderProfilesList() {
            const list = $('profiles-list');
            const profiles = Profiles.list();
            const activeId = Profiles.activeId();
            list.innerHTML = '';
            if (profiles.length === 0) {
                list.innerHTML = '<div class="empty-state"><div class="empty-icon">📁</div><div>Brak profili — dodaj pierwszy</div></div>';
                return;
            }
            profiles.forEach(p => {
                const card = document.createElement('div');
                card.className = 'profile-card' + (p.id === activeId ? ' active' : '');
                const rateInfo = p.mode === 'hourly'
                    ? `${fmt.num(p.hourly_rate)} zł/h`
                    : `${fmt.num(p.monthly_salary)} zł/m-c`;
                card.innerHTML = `
                    <div class="profile-card-info">
                        <div class="profile-card-name">${fmt.escapeHtml(p.name)} ${p.id === activeId ? '<span class="profile-chip">aktywny</span>' : ''}</div>
                        <div class="profile-card-meta">${fmt.escapeHtml(formLabel(p))} · ${rateInfo} ${p.is_brutto ? 'brutto' : 'netto'} · ${p.hours_per_month}h/m-c</div>
                    </div>
                    <div class="actions">
                        ${p.id !== activeId ? `<button class="btn btn-soft" data-activate="${p.id}">Ustaw aktywny</button>` : ''}
                        <button class="btn btn-secondary" data-edit="${p.id}">Edytuj</button>
                        <button class="btn btn-danger btn-icon-only" data-delete="${p.id}" title="Usuń">✕</button>
                    </div>
                `;
                list.appendChild(card);
            });

            list.querySelectorAll('[data-activate]').forEach(btn => btn.addEventListener('click', () => {
                Profiles.setActive(btn.dataset.activate);
                renderProfilesList();
                Toast.success('Profil ustawiony jako aktywny');
            }));
            list.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => {
                const p = Profiles.list().find(x => x.id === btn.dataset.edit);
                if (p) {
                    fillForm(p);
                    $('profile-form-section').scrollIntoView({ behavior: 'smooth' });
                }
            }));
            list.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => {
                if (confirm('Usunąć ten profil?')) {
                    Profiles.delete(btn.dataset.delete);
                    renderProfilesList();
                    Toast.success('Profil usunięty');
                }
            }));
        }

        // Initial: load existing first profile or open empty form
        const existing = Profiles.active() || Profiles.list()[0];
        if (existing) fillForm(existing);
        else resetForm();
        renderProfilesList();

        $('btn-new-profile').addEventListener('click', () => {
            resetForm();
            $('profile_name').focus();
        });

        $('btn-cancel').addEventListener('click', resetForm);

        $('btn-save-profile').addEventListener('click', async () => {
            const profile = readForm();
            if (profile.mode === 'hourly' && !profile.hourly_rate) { Toast.warning('Podaj stawkę godzinową.'); return; }
            if (profile.mode === 'monthly' && !profile.monthly_salary) { Toast.warning('Podaj pensję.'); return; }

            // Validate via API
            try { await API.profilePreview(profile); }
            catch (err) { Toast.error(err.message); return; }

            Profiles.save(profile);
            editingId = profile.id;
            Toast.success('✓ Profil zapisany');
            renderProfilesList();
        });

        $('btn-preview').addEventListener('click', async () => {
            const profile = readForm();
            try {
                const data = await API.profilePreview(profile);
                renderPreview(data);
            } catch (err) { Toast.error(err.message); }
        });

        $('btn-whatif').addEventListener('click', async () => {
            const active = Profiles.active();
            if (!active) { Toast.warning('Najpierw zapisz i ustaw aktywny profil.'); return; }
            const pct = parseFloat($('whatif_pct').value) || 0;
            try {
                const data = await API.whatif({ ...active, delta_pct: pct });
                renderWhatif(data, pct);
            } catch (err) { Toast.error(err.message); }
        });

        // Backup / restore
        $('btn-export').addEventListener('click', () => {
            const data = {
                version: 3,
                exported_at: new Date().toISOString(),
                profiles: Profiles.list(),
                active_profile: Profiles.activeId(),
                wishlist: Storage.get(Storage.keys.wishlist, []),
                goals: Storage.get(Storage.keys.goals, []),
                history: History.all(),
                categories: Storage.get(Storage.keys.categories, null),
                estimates: Storage.get(Storage.keys.estimates, {}),
                transactions: Storage.get(Storage.keys.transactions, []),
                snapshots: Storage.get(Storage.keys.snapshots, []),
                budget_mode: Storage.get(Storage.keys.budgetMode, 'estimates'),
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `przelicznik-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            Toast.success('Backup pobrany');
        });

        $('import-file').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                if (!data.profiles) throw new Error('Plik nie jest poprawnym backupem.');
                if (!confirm('Importować dane? Obecne dane zostaną nadpisane.')) return;
                Storage.set(Storage.keys.profiles, data.profiles || []);
                if (data.active_profile) Storage.set(Storage.keys.activeProfile, data.active_profile);
                if (data.wishlist) Storage.set(Storage.keys.wishlist, data.wishlist);
                if (data.goals) Storage.set(Storage.keys.goals, data.goals);
                if (data.history) Storage.set(Storage.keys.history, data.history);
                if (data.categories) Storage.set(Storage.keys.categories, data.categories);
                if (data.estimates) Storage.set(Storage.keys.estimates, data.estimates);
                if (data.transactions) Storage.set(Storage.keys.transactions, data.transactions);
                if (data.snapshots) Storage.set(Storage.keys.snapshots, data.snapshots);
                if (data.budget_mode) Storage.set(Storage.keys.budgetMode, data.budget_mode);
                Toast.success('Dane zaimportowane');
                setTimeout(() => location.reload(), 800);
            } catch (err) {
                Toast.error('Błąd importu: ' + err.message);
            }
        });

        $('btn-reset-all').addEventListener('click', () => {
            if (!confirm('Usunąć WSZYSTKIE dane (profile, listę, cele, historię)?')) return;
            Object.values(Storage.keys).forEach(k => {
                if (k !== Storage.keys.theme) Storage.remove(k);
            });
            Toast.success('Wszystkie dane usunięte');
            setTimeout(() => location.reload(), 800);
        });
    };

    function renderPreview(data) {
        $('preview-section').classList.remove('hidden');
        const rows = [
            ['Forma', fmt.escapeHtml(data.form_label)],
            ['Stawka netto', fmt.money(data.effective_hourly) + '/h'],
            ['Netto / m-c', fmt.money(data.monthly_netto)],
        ];
        if (data.monthly_gross) rows.push(['Brutto / m-c', fmt.money(data.monthly_gross)]);
        if (data.breakdown) {
            const b = data.breakdown;
            rows.push(['— Rozkład miesięczny —', '']);
            if (b.gross) rows.push(['Brutto', fmt.money(b.gross)]);
            if (b.zus_social) rows.push(['ZUS (społeczne)', '−' + fmt.money(b.zus_social)]);
            if (b.health) rows.push(['Składka zdrowotna', '−' + fmt.money(b.health)]);
            if (b.pit) rows.push(['PIT', '−' + fmt.money(b.pit)]);
            rows.push(['Netto', fmt.money(b.net)]);
        }
        $('preview-meta').innerHTML = rows.map(([k, v]) => `<div><strong>${k}</strong><span>${v}</span></div>`).join('');

        if (data.breakdown && window.Chart) {
            renderSalaryChart(data.breakdown);
        }
    }

    function renderSalaryChart(breakdown) {
        const ctx = $('salary-chart');
        if (!ctx) return;
        const isDark = Theme.get() === 'dark';
        const data = [
            { label: 'Netto (na rękę)', value: breakdown.net, color: '#10b981' },
            { label: 'ZUS społeczne', value: breakdown.zus_social, color: '#f59e0b' },
            { label: 'Zdrowotna', value: breakdown.health, color: '#ef4444' },
            { label: 'PIT', value: breakdown.pit, color: '#8b5cf6' },
        ].filter(d => d.value > 0);

        if (salaryChart) salaryChart.destroy();
        salaryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map(d => d.label),
                datasets: [{
                    data: data.map(d => d.value),
                    backgroundColor: data.map(d => d.color),
                    borderColor: isDark ? '#1f2937' : '#ffffff',
                    borderWidth: 2,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.label}: ${fmt.money(ctx.raw)} (${(ctx.raw / breakdown.gross * 100).toFixed(1)}%)`,
                        },
                    },
                },
                cutout: '60%',
            },
        });

        const legend = $('salary-chart-legend');
        legend.innerHTML = data.map(d =>
            `<div class="chart-legend-item"><span class="chart-legend-dot" style="background:${d.color}"></span>${d.label}: <strong>${fmt.money(d.value)}</strong></div>`
        ).join('');
    }

    function renderWhatif(data, pct) {
        const cls = data.diff_monthly_netto >= 0 ? 'whatif-diff-positive' : 'whatif-diff-negative';
        const sign = data.diff_monthly_netto >= 0 ? '+' : '';
        $('whatif-result').classList.remove('hidden');
        $('whatif-result').innerHTML = `
            <div style="font-size:var(--text-base);margin-bottom:var(--space-3);"><strong>Przy zmianie zarobków o ${sign}${pct}%:</strong></div>
            <div class="meta">
                <div><strong>Obecna pensja netto / m-c</strong><span>${fmt.money(data.base.monthly_netto)}</span></div>
                <div><strong>Nowa pensja netto / m-c</strong><span>${fmt.money(data.after.monthly_netto)}</span></div>
                <div><strong>Różnica miesięcznie</strong><span class="${cls}">${sign}${fmt.money(data.diff_monthly_netto)}</span></div>
                <div><strong>Różnica rocznie</strong><span class="${cls}">${sign}${fmt.money(data.diff_annual_netto)}</span></div>
                <div><strong>Stawka netto/h</strong><span>${fmt.money(data.base.effective_hourly)} → ${fmt.money(data.after.effective_hourly)}</span></div>
            </div>
        `;
    }

    // ============================================================
    // Budget page
    // ============================================================

    const DEFAULT_CATEGORIES = [
        { id: 'rent',          name: 'Mieszkanie / czynsz', emoji: '🏠', color: '#3b82f6', type: 'fixed',    limit: 0 },
        { id: 'utilities',     name: 'Media (prąd, gaz, woda)', emoji: '💡', color: '#06b6d4', type: 'fixed', limit: 0 },
        { id: 'internet',      name: 'Internet + telefon',  emoji: '📡', color: '#0ea5e9', type: 'fixed',    limit: 0 },
        { id: 'subs',          name: 'Subskrypcje',         emoji: '📺', color: '#8b5cf6', type: 'fixed',    limit: 0 },
        { id: 'food',          name: 'Jedzenie',            emoji: '🛒', color: '#10b981', type: 'variable', limit: 0 },
        { id: 'eating_out',    name: 'Restauracje',         emoji: '🍽️', color: '#f59e0b', type: 'variable', limit: 0 },
        { id: 'transport',     name: 'Transport / paliwo',  emoji: '🚗', color: '#ef4444', type: 'variable', limit: 0 },
        { id: 'entertainment', name: 'Rozrywka',            emoji: '🎮', color: '#ec4899', type: 'variable', limit: 0 },
        { id: 'health',        name: 'Zdrowie',             emoji: '🏥', color: '#14b8a6', type: 'fixed',    limit: 0 },
        { id: 'clothes',       name: 'Ubrania',             emoji: '👕', color: '#f97316', type: 'variable', limit: 0 },
        { id: 'other',         name: 'Inne',                emoji: '📦', color: '#64748b', type: 'variable', limit: 0 },
    ];

    Storage.keys.categories = 'przelicznik_categories';
    Storage.keys.estimates = 'przelicznik_estimates';
    Storage.keys.transactions = 'przelicznik_transactions';
    Storage.keys.snapshots = 'przelicznik_snapshots';
    Storage.keys.budgetMode = 'przelicznik_budget_mode';

    const Budget = {
        // Categories
        categories() {
            const stored = Storage.get(Storage.keys.categories, null);
            return stored ?? DEFAULT_CATEGORIES.slice();
        },
        saveCategories(list) { Storage.set(Storage.keys.categories, list); },
        category(id) { return this.categories().find(c => c.id === id); },

        // Mode
        mode() { return Storage.get(Storage.keys.budgetMode, 'estimates'); },
        setMode(m) { Storage.set(Storage.keys.budgetMode, m); },

        // Estimates: { 'YYYY-MM': { catId: amount, ... } }
        estimates() { return Storage.get(Storage.keys.estimates, {}); },
        estimatesForMonth(month) { return this.estimates()[month] || {}; },
        setEstimate(month, catId, amount) {
            const all = this.estimates();
            if (!all[month]) all[month] = {};
            all[month][catId] = amount;
            Storage.set(Storage.keys.estimates, all);
        },

        // Transactions: [{ id, date, amount, category, desc }]
        transactions() { return Storage.get(Storage.keys.transactions, []); },
        transactionsForMonth(month) {
            return this.transactions().filter(t => t.date.startsWith(month));
        },
        addTransaction(tx) {
            const list = this.transactions();
            list.push(tx);
            Storage.set(Storage.keys.transactions, list);
        },
        removeTransaction(id) {
            const list = this.transactions().filter(t => t.id !== id);
            Storage.set(Storage.keys.transactions, list);
        },

        // Aggregations
        expensesByCategory(month, mode) {
            const result = {};
            if (mode === 'estimates') {
                Object.assign(result, this.estimatesForMonth(month));
            } else {
                this.transactionsForMonth(month).forEach(t => {
                    result[t.category] = (result[t.category] || 0) + t.amount;
                });
            }
            return result;
        },
        totalExpenses(month, mode) {
            const byCat = this.expensesByCategory(month, mode);
            return Object.values(byCat).reduce((s, v) => s + (v || 0), 0);
        },

        // Snapshots
        snapshots() { return Storage.get(Storage.keys.snapshots, []); },
        addSnapshot(snap) {
            const list = this.snapshots().filter(s => s.month !== snap.month);
            list.push(snap);
            list.sort((a, b) => a.month.localeCompare(b.month));
            Storage.set(Storage.keys.snapshots, list);
        },
        removeSnapshot(month) {
            const list = this.snapshots().filter(s => s.month !== month);
            Storage.set(Storage.keys.snapshots, list);
        },
    };

    Pages.budget = function () {
        let currentMonth = monthKey(new Date()); // 'YYYY-MM'
        let currentMode = Budget.mode();
        let selectedDay = todayString();
        let editingCategoryId = null;
        let donutChart = null, barsChart = null, savingsLineChart = null;

        // Init: mode tabs
        document.querySelectorAll('#mode-tabs .inline-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                currentMode = tab.dataset.mode;
                Budget.setMode(currentMode);
                document.querySelectorAll('#mode-tabs .inline-tab').forEach(t => t.classList.toggle('active', t === tab));
                $('view-estimates').classList.toggle('hidden', currentMode !== 'estimates');
                $('view-transactions').classList.toggle('hidden', currentMode !== 'transactions');
                renderAll();
            });
        });
        const initialTab = document.querySelector(`#mode-tabs .inline-tab[data-mode="${currentMode}"]`);
        if (initialTab) {
            document.querySelectorAll('#mode-tabs .inline-tab').forEach(t => t.classList.toggle('active', t === initialTab));
            $('view-estimates').classList.toggle('hidden', currentMode !== 'estimates');
            $('view-transactions').classList.toggle('hidden', currentMode !== 'transactions');
        }

        // Init: month nav
        $('btn-prev-month').addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, -1); renderAll(); });
        $('btn-next-month').addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, +1); renderAll(); });
        $('btn-today').addEventListener('click', () => { currentMonth = monthKey(new Date()); selectedDay = todayString(); renderAll(); });

        // Init: snapshot
        $('btn-snapshot').addEventListener('click', () => createSnapshot());

        // Init: category form
        $('btn-add-category').addEventListener('click', () => openCategoryForm(null));
        $('btn-cancel-category').addEventListener('click', () => closeCategoryForm());
        $('btn-save-category').addEventListener('click', () => saveCategoryFromForm());

        // Init: transaction form
        $('tx-form').addEventListener('submit', e => {
            e.preventDefault();
            addTransactionFromForm();
        });

        // Render weekdays once
        $('calendar-weekdays').innerHTML = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']
            .map(d => `<div>${d}</div>`).join('');

        renderAll();

        // ------------------------------------------------------------

        async function renderAll() {
            updateMonthLabel();
            renderCategoriesList();
            populateCategorySelect();
            await renderSummary();
            renderEstimates();
            renderCalendar();
            renderTransactionsList();
            renderRule5030();
            renderGoalsProgress();
            renderSnapshots();
        }

        function updateMonthLabel() {
            const [year, month] = currentMonth.split('-');
            const d = new Date(parseInt(year), parseInt(month) - 1, 1);
            $('current-month-label').textContent = d.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
            $('current-month-meta').textContent = `${currentMonth}`;
        }

        async function renderSummary() {
            const profile = Profiles.active();
            const monthExpenses = Budget.totalExpenses(currentMonth, currentMode);

            let income = 0, effectiveHourly = 0;
            if (profile) {
                try {
                    const data = await API.profilePreview(profile);
                    income = data.monthly_netto;
                    effectiveHourly = data.effective_hourly;
                    $('sum-income-foot').textContent = data.form_label;
                } catch {
                    $('sum-income-foot').innerHTML = '<span style="color:var(--color-danger)">błąd profilu</span>';
                }
            } else {
                $('sum-income-foot').innerHTML = '<a href="/settings">ustaw profil</a>';
            }

            $('sum-income').textContent = income > 0 ? fmt.money(income) : '— zł';

            const savings = income - monthExpenses;
            $('sum-expenses').textContent = fmt.money(monthExpenses);
            $('sum-expenses-foot').textContent = income > 0
                ? `${((monthExpenses / income) * 100).toFixed(0)}% dochodu`
                : '';

            const savingsEl = $('sum-savings');
            savingsEl.textContent = fmt.money(savings);
            savingsEl.classList.toggle('negative', savings < 0);
            $('sum-savings-foot').textContent = income > 0 && savings >= 0
                ? `${((savings / income) * 100).toFixed(0)}% dochodu`
                : (savings < 0 ? '⚠ ujemne — wydajesz więcej niż zarabiasz' : '');

            const hours = effectiveHourly > 0 ? monthExpenses / effectiveHourly : 0;
            $('sum-time').textContent = hours > 0 ? `${fmt.int(hours)} h` : '— h';
            $('sum-time-foot').textContent = effectiveHourly > 0
                ? `przy ${fmt.money(effectiveHourly)}/h`
                : '';

            renderCharts(income, savings, monthExpenses);
        }

        function renderEstimates() {
            const cats = Budget.categories();
            const data = Budget.estimatesForMonth(currentMonth);
            renderEstimateGroup($('estimates-fixed'), cats.filter(c => c.type === 'fixed'), data);
            renderEstimateGroup($('estimates-variable'), cats.filter(c => c.type === 'variable'), data);
        }

        async function renderEstimateGroup(container, cats, data) {
            container.innerHTML = '';
            const profile = Profiles.active();
            let effectiveHourly = 0;
            if (profile) {
                try { effectiveHourly = (await API.profilePreview(profile)).effective_hourly; } catch {}
            }
            cats.forEach(cat => {
                const amount = data[cat.id] || 0;
                const hours = effectiveHourly > 0 ? amount / effectiveHourly : 0;
                const limitPct = cat.limit > 0 ? Math.min(120, (amount / cat.limit) * 100) : 0;
                const limitClass = cat.limit > 0
                    ? (amount > cat.limit ? 'bad' : amount > cat.limit * 0.8 ? 'warn' : '')
                    : '';

                const row = document.createElement('div');
                row.className = 'estimate-row';
                row.innerHTML = `
                    <div class="estimate-emoji" style="background:${cat.color}20;border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">${cat.emoji}</div>
                    <div class="estimate-name">${fmt.escapeHtml(cat.name)}<small>${cat.limit > 0 ? 'limit ' + fmt.money(cat.limit) : 'bez limitu'}</small></div>
                    <input type="number" class="estimate-input" step="1" min="0" value="${amount || ''}" placeholder="0" data-cat="${cat.id}">
                    <div class="estimate-time">${hours > 0 ? `${fmt.int(hours)} h pracy` : ''}</div>
                    <div>
                        ${cat.limit > 0 ? `
                            <div class="estimate-limit"><div class="estimate-limit-fill ${limitClass}" style="width:${limitPct}%"></div></div>
                            <span class="estimate-limit-label">${fmt.int((amount/cat.limit)*100 || 0)}% limitu</span>
                        ` : ''}
                    </div>
                `;
                container.appendChild(row);
            });

            container.querySelectorAll('.estimate-input').forEach(input => {
                input.addEventListener('change', () => {
                    const catId = input.dataset.cat;
                    const value = parseFloat(input.value) || 0;
                    Budget.setEstimate(currentMonth, catId, value);
                    renderAll();
                });
            });
        }

        function renderCalendar() {
            const [year, month] = currentMonth.split('-').map(Number);
            const firstDay = new Date(year, month - 1, 1);
            const lastDay = new Date(year, month, 0);
            const daysInMonth = lastDay.getDate();
            const startOffset = (firstDay.getDay() + 6) % 7; // Monday=0

            const txByDay = {};
            Budget.transactionsForMonth(currentMonth).forEach(t => {
                if (!txByDay[t.date]) txByDay[t.date] = [];
                txByDay[t.date].push(t);
            });

            const grid = $('calendar-grid');
            grid.innerHTML = '';

            // Previous month padding
            for (let i = 0; i < startOffset; i++) {
                const cell = document.createElement('div');
                cell.className = 'calendar-day other-month';
                grid.appendChild(cell);
            }

            const todayStr = todayString();
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
                const txs = txByDay[dateStr] || [];
                const sum = txs.reduce((s, t) => s + t.amount, 0);

                const cell = document.createElement('div');
                cell.className = 'calendar-day';
                if (dateStr === todayStr) cell.classList.add('today');
                if (dateStr === selectedDay) cell.classList.add('selected');

                let dotsHtml = '';
                if (txs.length > 0) {
                    const count = Math.min(txs.length, 4);
                    dotsHtml = `<div class="calendar-day-dots">${'<span class="calendar-dot' + (txs.length >= 4 ? '' : ' small') + '"></span>'.repeat(count > 4 ? 4 : count)}</div>`;
                }

                cell.innerHTML = `
                    <span class="calendar-day-num">${day}</span>
                    ${dotsHtml}
                    <span class="calendar-day-amt">${sum > 0 ? fmt.int(sum) + ' zł' : ''}</span>
                `;
                cell.addEventListener('click', () => {
                    selectedDay = dateStr;
                    renderCalendar();
                    renderDayDetail();
                });
                grid.appendChild(cell);
            }

            renderDayDetail();
        }

        function renderDayDetail() {
            const d = new Date(selectedDay);
            $('day-detail-title').textContent = d.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
            $('tx_date').value = selectedDay;

            const txs = Budget.transactionsForMonth(currentMonth).filter(t => t.date === selectedDay);
            const list = $('day-transactions');
            if (txs.length === 0) {
                list.innerHTML = `<p class="muted" style="margin:var(--space-2) 0 0;">Brak transakcji tego dnia.</p>`;
            } else {
                list.innerHTML = txs.map(t => {
                    const cat = Budget.category(t.category) || { emoji: '❓', name: '?' };
                    return `<div class="tx-row">
                        <span class="tx-emoji">${cat.emoji}</span>
                        <div class="tx-info"><div>${fmt.escapeHtml(cat.name)}</div>${t.desc ? `<div class="tx-desc">${fmt.escapeHtml(t.desc)}</div>` : ''}</div>
                        <span class="tx-amount">${fmt.money(t.amount)}</span>
                        <button class="tx-remove" data-tx-remove="${t.id}" title="Usuń">✕</button>
                    </div>`;
                }).join('');

                list.querySelectorAll('[data-tx-remove]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        Budget.removeTransaction(btn.dataset.txRemove);
                        renderAll();
                    });
                });
            }
        }

        function renderTransactionsList() {
            const txs = Budget.transactionsForMonth(currentMonth).slice().sort((a,b) => b.date.localeCompare(a.date));
            const container = $('all-transactions');
            if (txs.length === 0) {
                container.innerHTML = `<p class="muted">Brak transakcji w tym miesiącu.</p>`;
                return;
            }
            container.innerHTML = `<div class="table-wrap"><table class="data-table">
                <thead><tr><th>Data</th><th>Kategoria</th><th>Opis</th><th>Kwota</th><th></th></tr></thead>
                <tbody>${txs.map(t => {
                    const cat = Budget.category(t.category) || { emoji: '❓', name: '?' };
                    return `<tr>
                        <td>${t.date}</td>
                        <td>${cat.emoji} ${fmt.escapeHtml(cat.name)}</td>
                        <td>${fmt.escapeHtml(t.desc || '')}</td>
                        <td style="font-variant-numeric:tabular-nums;font-weight:600;">${fmt.money(t.amount)}</td>
                        <td><button class="btn-link btn-link-danger" data-tx-remove2="${t.id}">✕</button></td>
                    </tr>`;
                }).join('')}</tbody>
            </table></div>`;

            container.querySelectorAll('[data-tx-remove2]').forEach(btn => {
                btn.addEventListener('click', () => {
                    Budget.removeTransaction(btn.dataset.txRemove2);
                    renderAll();
                });
            });
        }

        function addTransactionFromForm() {
            const amount = parseFloat($('tx_amount').value);
            const category = $('tx_category').value;
            const date = $('tx_date').value || todayString();
            const desc = $('tx_desc').value.trim();
            if (!amount || amount <= 0) { Toast.warning('Podaj kwotę.'); return; }
            if (!category) { Toast.warning('Wybierz kategorię.'); return; }

            Budget.addTransaction({ id: 't_' + Date.now(), date, amount, category, desc });
            $('tx_amount').value = '';
            $('tx_desc').value = '';
            Toast.success(`Dodano ${fmt.money(amount)}`);
            renderAll();
        }

        function populateCategorySelect() {
            const sel = $('tx_category');
            const prev = sel.value;
            sel.innerHTML = Budget.categories().map(c =>
                `<option value="${c.id}">${c.emoji} ${fmt.escapeHtml(c.name)}</option>`
            ).join('');
            if (prev) sel.value = prev;
        }

        async function renderRule5030() {
            const profile = Profiles.active();
            if (!profile) { $('rule-bars').innerHTML = '<p class="muted">Ustaw profil zarobków, by zobaczyć regułę 50/30/20.</p>'; return; }
            let income = 0;
            try { income = (await API.profilePreview(profile)).monthly_netto; } catch { return; }
            if (income <= 0) return;

            const cats = Budget.categories();
            const byCat = Budget.expensesByCategory(currentMonth, currentMode);
            const fixed = cats.filter(c => c.type === 'fixed').reduce((s, c) => s + (byCat[c.id] || 0), 0);
            const variable = cats.filter(c => c.type === 'variable').reduce((s, c) => s + (byCat[c.id] || 0), 0);
            const savings = Math.max(0, income - fixed - variable);

            function bar(label, actual, target, classOk, classBad) {
                const pct = Math.min(150, (actual / target) * 100);
                const cls = actual > target * 1.1 ? classBad : (actual > target ? 'warn' : classOk);
                return `<div class="rule-bar">
                    <div class="rule-bar-header">
                        <span class="rule-bar-name">${label}</span>
                        <span class="rule-bar-meta">${fmt.money(actual)} / ${fmt.money(target)} (${fmt.int((actual/target)*100)}%)</span>
                    </div>
                    <div class="rule-bar-track">
                        <div class="rule-bar-fill ${cls}" style="width:${Math.min(100, (actual/target)*100)}%"></div>
                    </div>
                </div>`;
            }

            $('rule-bars').innerHTML =
                bar('🏠 Potrzeby (stałe) — cel ≤ 50%', fixed, income * 0.5, 'good', 'bad')
                + bar('🎮 Zachcianki (zmienne) — cel ≤ 30%', variable, income * 0.3, 'good', 'bad')
                + bar('💰 Oszczędności — cel ≥ 20%', savings, income * 0.2, 'good', 'warn');
        }

        function renderCharts(income, savings, totalExp) {
            const cats = Budget.categories();
            const byCat = Budget.expensesByCategory(currentMonth, currentMode);

            // Donut: stałe / zmienne / oszczędności
            const fixed = cats.filter(c => c.type === 'fixed').reduce((s, c) => s + (byCat[c.id] || 0), 0);
            const variable = cats.filter(c => c.type === 'variable').reduce((s, c) => s + (byCat[c.id] || 0), 0);
            const donutData = [];
            if (fixed > 0) donutData.push({ label: 'Stałe', value: fixed, color: '#06b6d4' });
            if (variable > 0) donutData.push({ label: 'Zmienne', value: variable, color: '#f59e0b' });
            if (savings > 0) donutData.push({ label: 'Oszczędności', value: savings, color: '#10b981' });

            if (donutChart) donutChart.destroy();
            if (donutData.length > 0 && window.Chart) {
                donutChart = new Chart($('chart-donut'), {
                    type: 'doughnut',
                    data: {
                        labels: donutData.map(d => d.label),
                        datasets: [{ data: donutData.map(d => d.value), backgroundColor: donutData.map(d => d.color), borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-bg-elevated'), borderWidth: 2 }],
                    },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${fmt.money(ctx.raw)}` } } }, cutout: '60%' },
                });
            }

            // Bars: per kategoria (top with non-zero)
            const barsData = cats
                .map(c => ({ cat: c, value: byCat[c.id] || 0 }))
                .filter(x => x.value > 0)
                .sort((a, b) => b.value - a.value);

            if (barsChart) barsChart.destroy();
            if (barsData.length > 0 && window.Chart) {
                barsChart = new Chart($('chart-bars'), {
                    type: 'bar',
                    data: {
                        labels: barsData.map(x => `${x.cat.emoji} ${x.cat.name}`),
                        datasets: [{ data: barsData.map(x => x.value), backgroundColor: barsData.map(x => x.cat.color) }],
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => fmt.money(ctx.raw) } } },
                        scales: { x: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--color-text-muted') } }, y: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--color-text-muted') } } },
                    },
                });
            }
        }

        function renderGoalsProgress() {
            const goals = Storage.get(Storage.keys.goals, []);
            const container = $('goals-progress');
            if (goals.length === 0) {
                container.innerHTML = '<p class="muted">Brak celów. <a href="/goals">Dodaj cel</a>.</p>';
                return;
            }
            container.innerHTML = goals.map(g => {
                const pct = Math.min(100, (g.saved / g.price) * 100);
                const remaining = Math.max(0, g.price - g.saved);
                const monthsLeft = g.monthly > 0 ? Math.ceil(remaining / g.monthly) : null;
                return `<div class="rule-bar">
                    <div class="rule-bar-header">
                        <span class="rule-bar-name">${fmt.escapeHtml(g.name)}</span>
                        <span class="rule-bar-meta">${fmt.money(g.saved)} / ${fmt.money(g.price)} · ${monthsLeft ? monthsLeft + ' ' + pluralPl(monthsLeft, 'miesiąc', 'miesiące', 'miesięcy') : 'brak planu'}</span>
                    </div>
                    <div class="rule-bar-track"><div class="rule-bar-fill ${pct >= 100 ? 'good' : ''}" style="width:${pct}%"></div></div>
                </div>`;
            }).join('');
        }

        async function createSnapshot() {
            const profile = Profiles.active();
            if (!profile) { Toast.error('Ustaw profil, by zamknąć miesiąc.'); return; }
            try {
                const data = await API.profilePreview(profile);
                const income = data.monthly_netto;
                const byCat = Budget.expensesByCategory(currentMonth, currentMode);
                const expenses = Object.values(byCat).reduce((s, v) => s + v, 0);
                const savings = income - expenses;

                if (!confirm(`Zapisać snapshot miesiąca ${currentMonth}?\n\nDochód: ${fmt.money(income)}\nWydatki: ${fmt.money(expenses)}\nOszczędności: ${fmt.money(savings)}`)) return;

                Budget.addSnapshot({
                    month: currentMonth,
                    income, expenses, savings,
                    expenses_by_category: byCat,
                    profile_name: profile.name,
                    closed_at: Date.now(),
                });
                Toast.success(`Snapshot ${currentMonth} zapisany`);
                renderSnapshots();
            } catch (err) {
                Toast.error(err.message);
            }
        }

        function renderSnapshots() {
            const snaps = Budget.snapshots();
            if (snaps.length === 0) {
                $('snapshots-empty').classList.remove('hidden');
                $('snapshots-content').classList.add('hidden');
                if (savingsLineChart) { savingsLineChart.destroy(); savingsLineChart = null; }
                return;
            }
            $('snapshots-empty').classList.add('hidden');
            $('snapshots-content').classList.remove('hidden');

            // Line chart
            if (savingsLineChart) savingsLineChart.destroy();
            if (window.Chart) {
                savingsLineChart = new Chart($('chart-savings-line'), {
                    type: 'line',
                    data: {
                        labels: snaps.map(s => s.month),
                        datasets: [
                            { label: 'Dochód', data: snaps.map(s => s.income), borderColor: '#10b981', backgroundColor: '#10b98120', tension: 0.3, fill: false },
                            { label: 'Wydatki', data: snaps.map(s => s.expenses), borderColor: '#ef4444', backgroundColor: '#ef444420', tension: 0.3, fill: false },
                            { label: 'Oszczędności', data: snaps.map(s => s.savings), borderColor: '#4f46e5', backgroundColor: '#4f46e520', tension: 0.3, fill: true },
                        ],
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt.money(ctx.raw)}` } } },
                        scales: { y: { ticks: { callback: v => fmt.int(v) + ' zł' } } },
                    },
                });
            }

            // Table
            $('snapshots-body').innerHTML = snaps.map((s, i) => {
                const prev = snaps[i - 1];
                const delta = prev ? s.savings - prev.savings : null;
                const deltaStr = delta === null ? '—' : (delta >= 0 ? `<span style="color:var(--color-success)">+${fmt.money(delta)}</span>` : `<span style="color:var(--color-danger)">${fmt.money(delta)}</span>`);
                return `<tr>
                    <td>${s.month}</td>
                    <td>${fmt.money(s.income)}</td>
                    <td>${fmt.money(s.expenses)}</td>
                    <td>${fmt.money(s.savings)}</td>
                    <td>${deltaStr}</td>
                    <td><button class="btn-link btn-link-danger" data-snap="${s.month}">Usuń</button></td>
                </tr>`;
            }).join('');

            document.querySelectorAll('[data-snap]').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (confirm(`Usunąć snapshot ${btn.dataset.snap}?`)) {
                        Budget.removeSnapshot(btn.dataset.snap);
                        renderSnapshots();
                    }
                });
            });
        }

        function renderCategoriesList() {
            const cats = Budget.categories();
            const list = $('categories-list');
            list.innerHTML = cats.map(c => `
                <div class="category-row">
                    <div class="category-row-emoji" style="background:${c.color}20;color:${c.color}">${c.emoji}</div>
                    <div class="category-row-info">
                        <div class="category-row-name">${fmt.escapeHtml(c.name)}</div>
                        <div class="category-row-meta">
                            <span class="category-chip ${c.type}">${c.type === 'fixed' ? 'stała' : 'zmienna'}</span>
                            ${c.limit > 0 ? ` · limit ${fmt.money(c.limit)}` : ' · bez limitu'}
                        </div>
                    </div>
                    <div class="actions">
                        <button class="btn btn-secondary" data-edit-cat="${c.id}">Edytuj</button>
                        <button class="btn btn-danger btn-icon-only" data-del-cat="${c.id}" title="Usuń">✕</button>
                    </div>
                </div>
            `).join('');

            list.querySelectorAll('[data-edit-cat]').forEach(btn =>
                btn.addEventListener('click', () => openCategoryForm(btn.dataset.editCat))
            );
            list.querySelectorAll('[data-del-cat]').forEach(btn =>
                btn.addEventListener('click', () => deleteCategory(btn.dataset.delCat))
            );
        }

        function openCategoryForm(id) {
            editingCategoryId = id;
            const form = $('category-form');
            form.classList.remove('hidden');
            $('category-form-title').textContent = id ? 'Edytuj kategorię' : 'Nowa kategoria';
            if (id) {
                const cat = Budget.category(id);
                if (cat) {
                    $('cat_emoji').value = cat.emoji || '';
                    $('cat_name').value = cat.name || '';
                    $('cat_color').value = cat.color || '#4f46e5';
                    $('cat_type').value = cat.type || 'variable';
                    $('cat_limit').value = cat.limit || 0;
                }
            } else {
                $('cat_emoji').value = '';
                $('cat_name').value = '';
                $('cat_color').value = '#4f46e5';
                $('cat_type').value = 'variable';
                $('cat_limit').value = '0';
            }
            form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        function closeCategoryForm() {
            $('category-form').classList.add('hidden');
            editingCategoryId = null;
        }

        function saveCategoryFromForm() {
            const emoji = $('cat_emoji').value.trim() || '📦';
            const name = $('cat_name').value.trim();
            const color = $('cat_color').value;
            const type = $('cat_type').value;
            const limit = parseFloat($('cat_limit').value) || 0;
            if (!name) { Toast.warning('Podaj nazwę.'); return; }

            const cats = Budget.categories();
            if (editingCategoryId) {
                const idx = cats.findIndex(c => c.id === editingCategoryId);
                if (idx >= 0) cats[idx] = { ...cats[idx], emoji, name, color, type, limit };
            } else {
                cats.push({ id: 'c_' + Date.now(), emoji, name, color, type, limit });
            }
            Budget.saveCategories(cats);
            closeCategoryForm();
            Toast.success('Zapisano kategorię');
            renderAll();
        }

        function deleteCategory(id) {
            if (!confirm('Usunąć kategorię? Wpisy w tej kategorii pozostaną ale stracą oznaczenie.')) return;
            const cats = Budget.categories().filter(c => c.id !== id);
            Budget.saveCategories(cats);
            Toast.success('Kategoria usunięta');
            renderAll();
        }
    };

    // Helpers for budget
    function monthKey(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    function todayString() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function shiftMonth(monthStr, delta) {
        const [y, m] = monthStr.split('-').map(Number);
        const d = new Date(y, m - 1 + delta, 1);
        return monthKey(d);
    }

    // ============================================================
    // Dispatch
    // ============================================================

    document.addEventListener('DOMContentLoaded', () => {
        Theme.init();
        Navbar.init();

        const page = document.body.dataset.page;
        if (page !== 'settings' && page !== 'about') {
            ProfileBanner.render();
        }

        if (Pages[page]) Pages[page]();
    });

})();
