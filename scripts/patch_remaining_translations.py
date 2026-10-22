# -*- coding: utf-8 -*-
"""
Authentic Native Translations for remaining untranslated prompt/action keys across all non-English locales.
Preserves 2,407 leaf keys, UTF-8 without BOM, CRLF, and 2-space indentation.
"""
import json
import os

LOCALES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../src/locales'))

UPDATES = {
    "ar": {
        "common.select_all": "تحديد الكل",
        "accounts.verification_guide.step6": "حدد \"التحقق من رقم هاتفك\" وأكمل رمز التحقق المكون من 6 أرقام عبر الرسائل القصيرة.",
        "accounts.verify_prompt": "يلزم التحقق من حساب Google للمتابعة.",
        "settings.warmup.monitored_models_desc": "حدد النماذج للإحماء. عندما تستعيد الحصة المتجددة لمدة 5 ساعات أو الأسبوعية 100%، يبدأ مسبار ضئيل الدورة الجديدة.",
        "settings.proxy_pool.add_proxy": "إضافة وكيل",
        "settings.proxy_pool.import_label": "لصق قائمة الوكلاء (واحد في كل سطر)",
        "settings.advanced.antigravity_cli_path_select": "تحديد الملف التنفيذي لـ Antigravity CLI (agy)",
        "proxy.config.experimental.compression_level_tooltip": "اختر مستوى ضغط السياق الذي تريد تمكينه. تنظيف السجلات وتنقية اللغة نشطان دائمًا دون أي حدود تبلغ 30 ألف رمز.",
        "proxy.config.opencode_sync.modal_title": "تحديد نماذج OpenCode",
        "proxy.config.opencode_sync.select_models": "تحديد النماذج للمزامنة",
        "proxy.config.droid_sync.modal_title": "إضافة نماذج إلى Droid",
        "proxy.config.droid_sync.btn_confirm_sync": "إضافة النماذج المحددة",
        "proxy.droid_sync.modal_title": "إضافة نماذج إلى Droid",
        "proxy.diagnostics.diagnostic_test_prompt": "موجه اختبار التشخيص",
        "proxy.diagnostics.enter_diagnostic_prompt": "أدخل موجه التشخيص...",
        "proxy.routing.add_mapping": "إضافة تعيين",
        "proxy.settings.enter_new_admin_password": "أدخل كلمة مرور المسؤول الجديدة",
        "update_notification.restart_prompt": "تم تنزيل التحديث وهو جاهز للتثبيت. هل تريد إعادة التشغيل الآن؟",
        "user_token.hint_custom_expires": "حدد التاريخ والساعة المحددين لانتهاء صلاحية هذا الرمز",
        "ecosystem.mcp.add_server": "إضافة خادم MCP",
        "ecosystem.rules.create": "إضافة قاعدة تعليمات",
        "theme.choose_accent": "اختر لون تمييز واجهة المستخدم",
    },
    "es": {
        "common.select_all": "Seleccionar todo",
        "accounts.verification_guide.step6": "Selecciona \"Verifica tu número de teléfono\" y completa el código de verificación por SMS de 6 dígitos.",
        "accounts.verify_prompt": "Se requiere la verificación de la cuenta de Google para continuar.",
        "settings.warmup.monitored_models_desc": "Seleccione modelos para calentar. Cuando la cuota móvil de 5 horas o semanal se recupera al 100%, una sonda mínima inicia el nuevo ciclo.",
        "proxy.droid_sync.modal_title": "Añadir modelos a Droid",
        "proxy.diagnostics.diagnostic_test_prompt": "Mensaje de prueba de diagnóstico",
        "proxy.diagnostics.enter_diagnostic_prompt": "Introduce el mensaje de diagnóstico...",
        "proxy.routing.add_mapping": "Añadir mapeo",
        "proxy.settings.enter_new_admin_password": "Introduce la nueva contraseña de administrador",
        "user_token.hint_custom_expires": "Seleccione la fecha y hora exactas en que caduca este token",
        "ecosystem.mcp.add_server": "Añadir servidor MCP",
        "ecosystem.rules.create": "Añadir regla de instrucción",
        "theme.choose_accent": "Elegir color de acento de UI",
        "security.stats.prompt": "Mensaje de entrada",
    },
    "fa": {
        "proxy.config.experimental.compression_level_tooltip": "سطح فشرده‌سازی کانتکست مورد نظر خود را انتخاب کنید. پاک‌سازی لاگ و خالص‌سازی زبان همیشه بدون محدودیت ۳۰ هزار توکن فعال هستند.",
        "proxy.config.opencode_sync.modal_title": "انتخاب مدل‌های OpenCode",
        "proxy.config.opencode_sync.select_models": "انتخاب مدل‌ها برای همگام‌سازی",
        "proxy.config.droid_sync.modal_title": "افزودن مدل‌ها به Droid",
        "proxy.config.droid_sync.btn_confirm_sync": "افزودن مدل‌های انتخاب‌شده",
        "proxy.diagnostics.diagnostic_test_prompt": "پرامپت تست عیب‌یابی",
        "proxy.diagnostics.enter_diagnostic_prompt": "پرامپت عیب‌یابی را وارد کنید...",
        "proxy.routing.add_mapping": "افزودن نگاشت",
        "proxy.settings.enter_new_admin_password": "رمز عبور جدید مدیر را وارد کنید",
    },
    "ja": {
        "common.select_all": "すべて選択",
        "accounts.verification_guide.step6": "「電話番号を確認」を選択し、6桁のSMS確認コードを入力してください。",
        "accounts.verify_prompt": "続行するにはGoogleアカウントの確認が必要です。",
        "settings.warmup.monitored_models_desc": "ウォームアップするモデルを選択します。5時間ローリングまたは週次クォータが100%に回復すると、最小限のプローブが新しいサイクルを開始します。",
        "settings.advanced.antigravity_cli_path_select": "Antigravity CLI (agy) 実行可能ファイルを選択",
        "proxy.config.experimental.compression_level_tooltip": "有効にするコンテキスト圧縮レベルを選択します。ログのクリーンアップと言語の浄化は、30kトークンの制限なしで常に有効です。",
        "proxy.config.opencode_sync.modal_title": "OpenCodeモデルを選択",
        "proxy.config.opencode_sync.select_models": "同期するモデルを選択",
        "proxy.droid_sync.modal_title": "Droidにモデルを追加",
        "proxy.diagnostics.diagnostic_test_prompt": "診断テストプロンプト",
        "proxy.diagnostics.enter_diagnostic_prompt": "診断プロンプトを入力...",
        "proxy.routing.add_mapping": "マッピングを追加",
        "proxy.settings.enter_new_admin_password": "新しい管理者パスワードを入力",
        "update_notification.restart_prompt": "アップデートがダウンロードされ、インストールの準備が整いました。今すぐ再起動しますか？",
        "user_token.hint_custom_expires": "このトークンの有効期限が切れる正確な日時を選択してください",
        "ecosystem.mcp.add_server": "MCPサーバーを追加",
        "ecosystem.rules.create": "指示ルールを追加",
        "theme.choose_accent": "UIアクセントカラーを選択",
    },
    "ko": {
        "common.select_all": "모두 선택",
        "accounts.verification_guide.step6": "\"전화번호 인증\"을 선택하고 6자리 SMS 인증 코드를 완료하세요.",
        "accounts.verify_prompt": "계속하려면 Google 계정 인증이 필요합니다.",
        "settings.warmup.monitored_models_desc": "워밍업할 모델을 선택하세요. 5시간 롤링 또는 주간 할당량이 100%로 복구되면 최소한의 프로브가 새 사이클을 시작합니다.",
        "proxy.droid_sync.modal_title": "Droid에 모델 추가",
        "proxy.diagnostics.diagnostic_test_prompt": "진단 테스트 프롬프트",
        "proxy.diagnostics.enter_diagnostic_prompt": "진단 프롬프트를 입력하세요...",
        "proxy.routing.add_mapping": "매핑 추가",
        "proxy.settings.enter_new_admin_password": "새 관리자 비밀번호 입력",
        "user_token.hint_custom_expires": "이 토큰이 만료되는 정확한 날짜와 시간을 선택하세요",
        "ecosystem.mcp.add_server": "MCP 서버 추가",
        "ecosystem.rules.create": "지시 규칙 추가",
        "theme.choose_accent": "UI 강조 색상 선택",
    },
    "my": {
        "common.select_all": "အားလုံးရွေးပါ",
        "accounts.verification_guide.step6": "\"သင့်ဖုန်းနံပါတ်ကို အတည်ပြုပါ\" ကို ရွေးပြီး ၆ လုံးပါ SMS အတည်ပြုကုဒ်ကို ဖြည့်ပါ။",
        "accounts.verify_prompt": "ဆက်လက်လုပ်ဆောင်ရန် Google အကောင့် အတည်ပြုခြင်း လိုအပ်ပါသည်။",
        "settings.warmup.monitored_models_desc": "နွေးထွေးစေရန် မော်ဒယ်များကို ရွေးချယ်ပါ။ ၅ နာရီ လှည့်ပတ်မှု သို့မဟုတ် အပတ်စဉ် ခွဲတမ်း ၁၀၀% ပြန်လည်ရရှိသောအခါ အနည်းဆုံး စမ်းသပ်မှုတစ်ခုက စက်ဝန်းအသစ်ကို စတင်စေပါသည်။",
        "settings.proxy_pool.add_proxy": "ပရောက်စီ ထည့်ပါ",
        "settings.proxy_pool.import_label": "ပရောက်စီစာရင်းကို ကူးထည့်ပါ (တစ်ကြောင်းလျှင် တစ်ခု)",
        "settings.advanced.antigravity_cli_path_select": "Antigravity CLI (agy) အသုံးပြုနိုင်သော ဖိုင်ကို ရွေးပါ",
        "proxy.config.experimental.compression_level_tooltip": "သင်ဖွင့်လိုသော အကြောင်းအရာချုံ့မှုအဆင့်ကို ရွေးချယ်ပါ။ မှတ်တမ်းသန့်ရှင်းရေးနှင့် ဘာသာစကားသန့်စင်မှုတို့သည် တိုကင် ၃၀,၀၀၀ ကန့်သတ်ချက်မရှိဘဲ အမြဲတမ်းအသုံးပြုနိုင်ပါသည်။",
        "proxy.config.opencode_sync.modal_title": "OpenCode မော်ဒယ်များကို ရွေးပါ",
        "proxy.config.opencode_sync.select_models": "ချိန်ညှိရန် မော်ဒယ်များကို ရွေးပါ",
        "proxy.config.droid_sync.modal_title": "Droid ထံသို့ မော်ဒယ်များ ထည့်ပါ",
        "proxy.config.droid_sync.btn_confirm_sync": "ရွေးချယ်ထားသော မော်ဒယ်များကို ထည့်ပါ",
        "proxy.droid_sync.modal_title": "Droid ထံသို့ မော်ဒယ်များ ထည့်ပါ",
        "proxy.diagnostics.diagnostic_test_prompt": "ရောဂါရှာဖွေစစ်ဆေးမှု စာသား",
        "proxy.diagnostics.enter_diagnostic_prompt": "ရောဂါရှာဖွေမှု စာသားကို ရိုက်ထည့်ပါ...",
        "proxy.routing.add_mapping": "မြေပုံဆွဲခြင်း ထည့်ပါ",
        "proxy.settings.enter_new_admin_password": "စီမံခန့်ခွဲသူ စကားဝှက်အသစ် ထည့်ပါ",
        "update_notification.restart_prompt": "အပ်ဒိတ်ကို ဒေါင်းလုဒ်လုပ်ပြီး တပ်ဆင်ရန် အသင့်ဖြစ်ပါပြီ။ ယခု ပြန်လည်စတင်မလား?",
        "user_token.hint_custom_expires": "ဤတိုကင် သက်တမ်းကုန်ဆုံးမည့် အတိအကျ ရက်စွဲနှင့် အချိန်ကို ရွေးပါ",
        "ecosystem.mcp.add_server": "MCP ဆာဗာ ထည့်ပါ",
        "ecosystem.rules.create": "ညွှန်ကြားချက် စည်းမျဉ်း ထည့်ပါ",
        "theme.choose_accent": "UI အရောင် အသားပေးကို ရွေးပါ",
        "security.stats.prompt": "အချက်ပြ စာသား",
        "security.blacklist.add_ip": "IP ထည့်ပါ",
        "security.blacklist.add_title": "အမည်ပျက်စာရင်းသို့ ထည့်ပါ",
        "security.whitelist.add_ip": "ယုံကြည်ရသော IP ထည့်ပါ",
        "security.whitelist.add_title": "ခွင့်ပြုစာရင်းသို့ ထည့်ပါ",
    },
    "pt": {
        "accounts.verify_prompt": "A verificação da conta do Google é necessária para continuar.",
        "settings.proxy_pool.add_proxy": "Adicionar proxy",
        "settings.proxy_pool.import_label": "Colar lista de proxies (um por linha)",
        "proxy.diagnostics.diagnostic_test_prompt": "Prompt de teste de diagnóstico",
        "proxy.diagnostics.enter_diagnostic_prompt": "Digite o prompt de diagnóstico...",
        "proxy.routing.add_mapping": "Adicionar mapeamento",
        "proxy.settings.enter_new_admin_password": "Digite a nova senha de administrador",
        "security.stats.prompt": "Prompt de entrada",
        "ecosystem.mcp.add_server": "Adicionar servidor MCP",
        "ecosystem.rules.create": "Adicionar regra de instrução",
        "theme.choose_accent": "Escolher cor de destaque da UI",
    },
    "ru": {
        "common.select_all": "Выбрать все",
        "accounts.verification_guide.step6": "Выберите «Подтвердить номер телефона» и введите 6-значный проверочный код из SMS.",
        "accounts.verify_prompt": "Для продолжения требуется подтверждение аккаунта Google.",
        "settings.warmup.monitored_models_desc": "Выберите модели для прогрева. Когда 5-часовая скользящая или недельная квота восстанавливается до 100%, минимальный зонд запускает новый цикл.",
        "settings.proxy_pool.add_proxy": "Добавить прокси",
        "settings.proxy_pool.import_label": "Вставить список прокси (по одному в строке)",
        "proxy.droid_sync.modal_title": "Добавить модели в Droid",
        "proxy.diagnostics.diagnostic_test_prompt": "Тестовый запрос диагностики",
        "proxy.diagnostics.enter_diagnostic_prompt": "Введите запрос диагностики...",
        "proxy.routing.add_mapping": "Добавить сопоставление",
        "proxy.settings.enter_new_admin_password": "Введите новый пароль администратора",
        "user_token.hint_custom_expires": "Выберите точную дату и время истечения срока действия этого токена",
        "ecosystem.mcp.add_server": "Добавить сервер MCP",
        "ecosystem.rules.create": "Добавить правило инструкций",
        "theme.choose_accent": "Выберите акцентный цвет интерфейса",
    },
    "tr": {
        "common.select_all": "Tümünü Seç",
        "accounts.verification_guide.step6": "\"Telefon numaranızı doğrulayın\"ı seçin ve 6 haneli SMS doğrulama kodunu tamamlayın.",
        "accounts.verify_prompt": "Devam etmek için Google hesabı doğrulaması gereklidir.",
        "settings.warmup.monitored_models_desc": "Isınacak modelleri seçin. 5 saatlik değişken veya haftalık kota %100'e ulaştığında, minimum bir yoklama yeni döngüyü başlatır.",
        "settings.quota_protection.monitored_models_desc": "En az bir tane seçin. Seçilen modellerden HERHANGİ BİRİ eşiğin altına düşerse koruma tetiklenir",
        "settings.proxy_pool.add_proxy": "Proxy Ekle",
        "settings.proxy_pool.import_label": "Proxy Listesini Yapıştırın (Her satıra bir tane)",
        "settings.advanced.antigravity_cli_path_select": "Antigravity CLI (agy) Yürütülebilir Dosyasını Seçin",
        "proxy.config.experimental.compression_level_tooltip": "Etkinleştirmek istediğiniz bağlam sıkıştırma düzeyini seçin. Günlük temizleme ve dil arındırma, 30k belirteç sınırı olmaksızın her zaman etkindir.",
        "proxy.config.opencode_sync.modal_title": "OpenCode Modellerini Seçin",
        "proxy.config.opencode_sync.select_models": "Senkronize edilecek modelleri seçin",
        "proxy.config.droid_sync.modal_title": "Modelleri Droid'e ekleyin",
        "proxy.config.droid_sync.btn_confirm_sync": "Seçilen modelleri ekle",
        "proxy.droid_sync.modal_title": "Modelleri Droid'e Ekle",
        "proxy.diagnostics.diagnostic_test_prompt": "Tanılama Test İstemi",
        "proxy.diagnostics.enter_diagnostic_prompt": "Tanılama istemini girin...",
        "proxy.routing.add_mapping": "Eşleme Ekle",
        "proxy.settings.enter_new_admin_password": "Yeni yönetici şifresini girin",
        "update_notification.restart_prompt": "Güncelleme indirildi ve yüklenmeye hazır. Şimdi yeniden başlatılsın mı?",
        "user_token.hint_custom_expires": "Bu belirtecin süresinin dolacağı tam tarih ve saati seçin",
    },
    "vi": {
        "common.select_all": "Chọn tất cả",
        "accounts.verification_guide.step6": "Chọn \"Xác minh số điện thoại của bạn\" và hoàn tất mã xác minh SMS 6 chữ số.",
        "accounts.verify_prompt": "Cần xác minh tài khoản Google để tiếp tục.",
        "settings.warmup.monitored_models_desc": "Chọn các mô hình để làm ấm. Khi hạn ngạch 5 giờ cuốn chiếu hoặc hàng tuần phục hồi về 100%, một đầu dò tối thiểu sẽ bắt đầu chu kỳ mới.",
        "settings.proxy_pool.add_proxy": "Thêm proxy",
        "settings.proxy_pool.import_label": "Dán danh sách proxy (Mỗi dòng một proxy)",
        "settings.advanced.antigravity_cli_path_select": "Chọn tệp thực thi Antigravity CLI (agy)",
        "proxy.config.experimental.compression_level_tooltip": "Chọn mức độ nén ngữ cảnh bạn muốn bật. Dọn dẹp nhật ký và tinh lọc ngôn ngữ luôn hoạt động mà không có bất kỳ giới hạn 30k mã thông báo nào.",
        "proxy.config.opencode_sync.modal_title": "Chọn mô hình OpenCode",
        "proxy.config.opencode_sync.select_models": "Chọn mô hình để đồng bộ",
        "proxy.config.droid_sync.modal_title": "Thêm mô hình vào Droid",
        "proxy.config.droid_sync.btn_confirm_sync": "Thêm mô hình đã chọn",
        "proxy.droid_sync.modal_title": "Thêm mô hình vào Droid",
        "proxy.diagnostics.diagnostic_test_prompt": "Lời nhắc kiểm tra chẩn đoán",
        "proxy.diagnostics.enter_diagnostic_prompt": "Nhập lời nhắc chẩn đoán...",
        "proxy.routing.add_mapping": "Thêm ánh xạ",
        "proxy.settings.enter_new_admin_password": "Nhập mật khẩu quản trị mới",
        "update_notification.restart_prompt": "Bản cập nhật đã được tải xuống và sẵn sàng cài đặt. Khởi động lại ngay?",
        "user_token.hint_custom_expires": "Chọn ngày và giờ chính xác khi mã thông báo này hết hạn",
        "ecosystem.mcp.add_server": "Thêm máy chủ MCP",
        "ecosystem.rules.create": "Thêm quy tắc chỉ dẫn",
        "theme.choose_accent": "Chọn màu nhấn giao diện",
    },
    "zh": {
        "proxy.diagnostics.diagnostic_test_prompt": "诊断测试提示词",
        "proxy.diagnostics.enter_diagnostic_prompt": "输入诊断提示词...",
        "proxy.routing.add_mapping": "添加映射",
        "proxy.settings.enter_new_admin_password": "输入新管理员密码",
        "ecosystem.rules.add_new_agent_rule": "添加新智能体规则",
        "ecosystem.reorder_prompt": "最新下载量与排名已通过 Hub CDN 同步。",
    },
    "zh-TW": {
        "proxy.diagnostics.diagnostic_test_prompt": "診斷測試提示詞",
        "proxy.diagnostics.enter_diagnostic_prompt": "輸入診斷提示詞...",
        "proxy.routing.add_mapping": "新增對應",
        "proxy.settings.enter_new_admin_password": "輸入新管理員密碼",
        "ecosystem.rules.add_new_agent_rule": "新增代理規則",
        "ecosystem.reorder_prompt": "最新下載次數與排名已透過 Hub CDN 同步。",
    }
}

def set_nested(data, key_path, val):
    parts = key_path.split('.')
    cur = data
    for part in parts[:-1]:
        if part not in cur or not isinstance(cur[part], dict):
            cur[part] = {}
        cur = cur[part]
    cur[parts[-1]] = val

def flatten(d, p=''):
    r = {}
    for k, v in d.items():
        fp = f'{p}.{k}' if p else k
        if isinstance(v, dict): r.update(flatten(v, fp))
        else: r[fp] = str(v)
    return r

def main():
    en_path = os.path.join(LOCALES_DIR, 'en.json')
    with open(en_path, 'r', encoding='utf-8') as f:
        en_data = json.load(f)
    en_flat = flatten(en_data)
    canonical_count = len(en_flat)
    print(f"Canonical leaf keys in en.json: {canonical_count}")

    for loc, patches in UPDATES.items():
        loc_path = os.path.join(LOCALES_DIR, f"{loc}.json")
        with open(loc_path, 'r', encoding='utf-8') as f:
            loc_data = json.load(f)

        applied = 0
        for k, v in patches.items():
            if k in en_flat:
                set_nested(loc_data, k, v)
                applied += 1
            else:
                print(f"WARNING: Key {k} not found in en.json!")

        # Serialize with 2 spaces, UTF-8, no BOM, CRLF
        json_str = json.dumps(loc_data, ensure_ascii=False, indent=2)
        # Ensure CRLF
        json_str = json_str.replace('\r\n', '\n').replace('\n', '\r\n') + '\r\n'

        with open(loc_path, 'wb') as f:
            f.write(json_str.encode('utf-8'))

        # Verify key count
        loc_flat = flatten(json.loads(json_str))
        assert len(loc_flat) == canonical_count, f"{loc} count {len(loc_flat)} != {canonical_count}"
        print(f"[{loc}] Successfully applied {applied} translations, total keys: {len(loc_flat)}")

if __name__ == '__main__':
    main()
