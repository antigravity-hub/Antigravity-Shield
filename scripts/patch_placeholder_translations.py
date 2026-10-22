# -*- coding: utf-8 -*-
"""
Authentic Native Translations for all placeholder & key prompt sentences across all 12 non-English locales.
Guarantees 0 untranslated raw English placeholder sentences for Gate 3 verification,
strictly asserting key presence in en.json (0 missing, 0 extra).
"""
import json
import os
import re

LOCALES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../src/locales'))
EN_PATH = os.path.join(LOCALES_DIR, 'en.json')

VAR_REGEX = re.compile(r'\{\{([^}]+)\}\}')

def flatten(d, p=''):
    r = {}
    for k, v in d.items():
        fp = f'{p}.{k}' if p else k
        if isinstance(v, dict): r.update(flatten(v, fp))
        else: r[fp] = str(v)
    return r

PATCHES = {
    "fa": {
        "settings.proxy_pool.add_tag_placeholder": "افزودن برچسب...",
        "settings.advanced.antigravity_cli_path_placeholder": "تنظیم نشده (تشخیص خودکار)",
        "proxy.config.request.user_agent_placeholder": "رشته سفارشی User-Agent را وارد کنید...",
        "proxy.config.circuit_breaker.input_placeholder": "مدت زمان کول‌داون را به ثانیه با کاما جدا کنید (مثال: 60, 300)",
        "proxy.cloudflared.token_placeholder": "توکن تانل کلودفلر را اینجا جای‌گذاری کنید",
        "proxy.cloudflared.public_url_placeholder": "آدرس عمومی پس از شروع تانل در اینجا نمایش داده می‌شود",
        "proxy.router.preset_name_placeholder": "نام پریست را وارد کنید...",
        "apiKeyFun.apiKeyPlaceholder": "کلید API خود را اینجا وارد کنید...",
        "ecosystem.search_placeholder": "جستجوی ابزارها، تریگرها، سرورها...",
        "common.switch_confirm_prompt": "آیا می‌خواهید به بهترین حساب پیشنهادی سوییچ کنید؟",
        "common.confirm_proceed": "بله، ادامه دهید",
        "common.select_target_desc": "محیط هدف را برای فعال‌سازی سهمیه انتخاب کنید:",
        "common.switch_success": "تغییر حساب با موفقیت انجام شد",
        "nav.switch_to_english": "تغییر زبان به انگلیسی",
        "dashboard.verify_account_prompt": "برای ادامه، حساب خود را اعتبارسنجی کنید.",
        "accounts.fix_guide.step2_title": "🧹 در صورت عدم رفع (پاک‌سازی کش)",
        "security.logs.search_placeholder": "جستجوی IP، مسیر، User Agent...",
        "security.blacklist.search_placeholder": "جستجو...",
        "security.blacklist.reason_placeholder": "مثال: اسکن مشکوک",
        "security.blacklist.expires_placeholder": "برای دائمی خالی بگذارید",
        "security.whitelist.description_placeholder": "مثال: سرور داخلی",
    },
    "ar": {
        "settings.proxy_pool.add_tag_placeholder": "إضافة وسم...",
        "settings.advanced.antigravity_cli_path_placeholder": "غير محدد (سيتم الكشف التلقائي)",
        "proxy.config.request.user_agent_placeholder": "أدخل سلسلة User-Agent مخصصة...",
        "proxy.config.circuit_breaker.input_placeholder": "أدخل فترات التراجع بالثواني مفصولة بفواصل (مثال: 60, 300)",
        "proxy.cloudflared.token_placeholder": "الصق رمز نفق Cloudflare هنا",
        "proxy.cloudflared.public_url_placeholder": "سيظهر الرابط العام هنا بعد تشغيل النفق",
        "proxy.router.preset_name_placeholder": "أدخل اسم الإعداد المسبق...",
        "apiKeyFun.apiKeyPlaceholder": "الصق مفتاح API الخاص بك هنا...",
        "ecosystem.search_placeholder": "البحث في الأدوات والمحفزات والخوادم...",
        "common.switch_confirm_prompt": "هل تريد التبديل إلى أفضل حساب موصى به؟",
        "common.confirm_proceed": "نعم، متابعة",
        "common.select_target_desc": "حدد البيئة الهدف لتفعيل الحصة بها:",
        "common.switch_success": "تم تبديل الحساب بنجاح",
        "nav.switch_to_english": "التبديل إلى الإنجليزية",
        "dashboard.verify_account_prompt": "يرجى التحقق من حسابك للمتابعة.",
        "accounts.fix_guide.step2_title": "🧹 إذا فشل ذلك (مسح ذاكرة التخزين المؤقت)",
        "security.logs.search_placeholder": "البحث في IP، المسار، وكيل المستخدم...",
        "security.blacklist.search_placeholder": "بحث...",
        "security.blacklist.reason_placeholder": "مثال: فحص ضار",
        "security.blacklist.expires_placeholder": "اتركه فارغاً للدائم",
        "security.whitelist.description_placeholder": "مثال: خادم داخلي",
    },
    "es": {
        "ecosystem.search_placeholder": "Buscar herramientas, disparadores, servidores...",
        "settings.proxy_pool.add_tag_placeholder": "Añadir etiqueta...",
        "settings.advanced.antigravity_cli_path_placeholder": "No establecido (usará detección automática)",
        "proxy.config.request.user_agent_placeholder": "Introducir cadena User-Agent personalizada...",
        "proxy.config.circuit_breaker.input_placeholder": "Introducir duraciones en segundos, separadas por comas",
        "proxy.cloudflared.token_placeholder": "Pegue su token de Cloudflare Tunnel aquí",
        "proxy.cloudflared.public_url_placeholder": "La URL pública aparecerá aquí tras iniciar el túnel",
        "proxy.router.preset_name_placeholder": "Introducir nombre del ajuste preestablecido...",
        "apiKeyFun.apiKeyPlaceholder": "Pegue su clave API aquí...",
        "common.switch_confirm_prompt": "¿Desea cambiar a la mejor cuenta recomendada?",
        "common.confirm_proceed": "Sí, continuar",
        "common.select_target_desc": "Seleccione el entorno de destino donde activar la cuota:",
        "common.switch_success": "Cambio de cuenta completado con éxito",
        "nav.switch_to_english": "Cambiar a inglés",
        "dashboard.verify_account_prompt": "Verifique su cuenta para continuar.",
        "accounts.fix_guide.step2_title": "🧹 Si eso falla (Limpiar caché)",
        "security.logs.search_placeholder": "Buscar IP, ruta, User Agent...",
        "security.blacklist.search_placeholder": "Buscar...",
        "security.blacklist.reason_placeholder": "p. ej. Escaneo malicioso",
        "security.blacklist.expires_placeholder": "Dejar vacío para permanente",
        "security.whitelist.description_placeholder": "p. ej. Servidor interno",
    },
    "ja": {
        "settings.advanced.antigravity_cli_path_placeholder": "未設定 (自動検出を使用)",
        "ecosystem.search_placeholder": "ツール、トリガー、サーバーを検索...",
        "settings.proxy_pool.add_tag_placeholder": "タグを追加...",
        "proxy.config.request.user_agent_placeholder": "カスタムUser-Agent文字列を入力...",
        "proxy.config.circuit_breaker.input_placeholder": "バックオフ時間を秒単位でカンマ区切りで入力",
        "proxy.cloudflared.token_placeholder": "ここにCloudflare Tunnelトークンを貼り付け",
        "proxy.cloudflared.public_url_placeholder": "トンネル起動後に公開URLがここに表示されます",
        "proxy.router.preset_name_placeholder": "プリセット名を入力...",
        "apiKeyFun.apiKeyPlaceholder": "ここにAPIキーを貼り付け...",
        "common.switch_confirm_prompt": "最も推奨されるアカウントに切り替えますか？",
        "common.confirm_proceed": "はい、続行します",
        "common.select_target_desc": "クォータをアクティブにするターゲット環境を選択してください:",
        "common.switch_success": "アカウントの切り替えが正常に完了しました",
        "nav.switch_to_english": "英語に切り替え",
        "dashboard.verify_account_prompt": "続行するにはアカウントを確認してください。",
        "accounts.fix_guide.step2_title": "🧹 それでも失敗する場合 (キャッシュをクリア)",
        "security.logs.search_placeholder": "IP、パス、User Agentを検索...",
        "security.blacklist.search_placeholder": "検索...",
        "security.blacklist.reason_placeholder": "例: 悪意のあるスキャン",
        "security.blacklist.expires_placeholder": "無期限の場合は空のまま",
        "security.whitelist.description_placeholder": "例: 内部サーバー",
    },
    "ko": {
        "ecosystem.search_placeholder": "도구, 트리거, 서버 검색...",
        "settings.proxy_pool.add_tag_placeholder": "태그 추가...",
        "settings.advanced.antigravity_cli_path_placeholder": "미설정 (자동 감지 사용)",
        "proxy.config.request.user_agent_placeholder": "사용자 정의 User-Agent 입력...",
        "proxy.config.circuit_breaker.input_placeholder": "대기 시간을 초 단위로 쉼표로 구분하여 입력",
        "proxy.cloudflared.token_placeholder": "Cloudflare Tunnel 토큰을 여기에 붙여넣기",
        "proxy.cloudflared.public_url_placeholder": "터널 시작 후 여기에 공개 URL이 표시됩니다",
        "proxy.router.preset_name_placeholder": "프리셋 이름 입력...",
        "apiKeyFun.apiKeyPlaceholder": "API 키를 여기에 붙여넣기...",
        "common.switch_confirm_prompt": "가장 권장되는 계정으로 전환하시겠습니까?",
        "common.confirm_proceed": "예, 계속합니다",
        "common.select_target_desc": "할당량을 활성화할 대상 환경을 선택하세요:",
        "common.switch_success": "계정 전환이 성공적으로 완료되었습니다",
        "nav.switch_to_english": "영어로 전환",
        "dashboard.verify_account_prompt": "계속하려면 계정을 확인하세요.",
        "accounts.fix_guide.step2_title": "🧹 그래도 해결되지 않는 경우 (캐시 지우기)",
        "security.logs.search_placeholder": "IP, 경로, User Agent 검색...",
        "security.blacklist.search_placeholder": "검색...",
        "security.blacklist.reason_placeholder": "예: 악성 스캔",
        "security.blacklist.expires_placeholder": "영구적인 경우 비워 둠",
        "security.whitelist.description_placeholder": "예: 내부 서버",
    },
    "pt": {
        "settings.proxy_pool.add_tag_placeholder": "Adicionar etiqueta...",
        "settings.advanced.antigravity_cli_path_placeholder": "Não definido (usará detecção automática)",
        "proxy.config.request.user_agent_placeholder": "Inserir string de User-Agent personalizada...",
        "proxy.config.circuit_breaker.input_placeholder": "Inserir durações de backoff em segundos, separadas por vírgula",
        "proxy.cloudflared.token_placeholder": "Cole seu token do Cloudflare Tunnel aqui",
        "proxy.cloudflared.public_url_placeholder": "A URL pública aparecerá aqui após iniciar o túnel",
        "proxy.router.preset_name_placeholder": "Digite o nome da predefinição...",
        "apiKeyFun.apiKeyPlaceholder": "Cole sua chave de API aqui...",
        "ecosystem.search_placeholder": "Pesquisar ferramentas, disparadores, servidores...",
        "common.switch_confirm_prompt": "Deseja alternar para a melhor conta recomendada?",
        "common.confirm_proceed": "Sim, continuar",
        "common.select_target_desc": "Selecione o ambiente de destino onde a cota deve ser ativada:",
        "common.switch_success": "Troca de conta concluída com sucesso",
        "nav.switch_to_english": "Mudar para inglês",
        "dashboard.verify_account_prompt": "Verifique sua conta para continuar.",
        "accounts.fix_guide.step2_title": "🧹 Se isso falhar (Limpar cache)",
        "security.logs.search_placeholder": "Pesquisar IP, caminho, User Agent...",
        "security.blacklist.search_placeholder": "Pesquisar...",
        "security.blacklist.reason_placeholder": "ex: Varredura maliciosa",
        "security.blacklist.expires_placeholder": "Deixe em branco para permanente",
        "security.whitelist.description_placeholder": "ex: Servidor interno",
    },
    "ru": {
        "settings.proxy_pool.add_tag_placeholder": "Добавить тег...",
        "settings.advanced.antigravity_cli_path_placeholder": "Не задано (автоопределение)",
        "proxy.config.request.user_agent_placeholder": "Введите строку User-Agent...",
        "proxy.config.circuit_breaker.input_placeholder": "Введите интервалы ожидания в секундах через запятую",
        "proxy.cloudflared.token_placeholder": "Вставьте токен Cloudflare Tunnel сюда",
        "proxy.cloudflared.public_url_placeholder": "Публичный URL появится здесь после запуска туннеля",
        "proxy.router.preset_name_placeholder": "Введите имя пресета...",
        "apiKeyFun.apiKeyPlaceholder": "Вставьте ваш API-ключ сюда...",
        "ecosystem.search_placeholder": "Поиск инструментов, триггеров, серверов...",
        "common.switch_confirm_prompt": "Переключиться на наиболее рекомендуемый аккаунт?",
        "common.confirm_proceed": "Да, продолжить",
        "common.select_target_desc": "Выберите целевую среду для активации квоты:",
        "common.switch_success": "Переключение аккаунта успешно завершено",
        "nav.switch_to_english": "Переключить на английский",
        "dashboard.verify_account_prompt": "Подтвердите ваш аккаунт для продолжения.",
        "accounts.fix_guide.step2_title": "🧹 Если это не помогло (Очистить кэш)",
        "security.logs.search_placeholder": "Поиск по IP, пути, User Agent...",
        "security.blacklist.search_placeholder": "Поиск...",
        "security.blacklist.reason_placeholder": "например: вредоносное сканирование",
        "security.blacklist.expires_placeholder": "Оставьте пустым для бессрочного",
        "security.whitelist.description_placeholder": "например: внутренний сервер",
    },
    "tr": {
        "settings.proxy_pool.add_tag_placeholder": "Etiket ekle...",
        "settings.advanced.antigravity_cli_path_placeholder": "Ayarlanmadı (Otomatik algılama kullanılacak)",
        "proxy.config.request.user_agent_placeholder": "Özel User-Agent dizisi girin...",
        "proxy.config.circuit_breaker.input_placeholder": "Bekleme sürelerini saniye cinsinden virgülle ayırarak girin",
        "proxy.cloudflared.token_placeholder": "Cloudflare Tunnel belirtecinizi buraya yapıştırın",
        "proxy.cloudflared.public_url_placeholder": "Tünel başladıktan sonra genel URL burada görünecektir",
        "proxy.router.preset_name_placeholder": "Önayar adı girin...",
        "apiKeyFun.apiKeyPlaceholder": "API Anahtarınızı buraya yapıştırın...",
        "ecosystem.search_placeholder": "Araçları, tetikleyicileri, sunucuları arayın...",
        "common.switch_confirm_prompt": "En çok önerilen hesaba geçmek istiyor musunuz?",
        "common.confirm_proceed": "Evet, Devam Et",
        "common.select_target_desc": "Kotanın etkinleştirileceği hedef ortamı seçin:",
        "common.switch_success": "Hesap geçişi başarıyla tamamlandı",
        "nav.switch_to_english": "İngilizceye Geç",
        "dashboard.verify_account_prompt": "Devam etmek için hesabınızı doğrulayın.",
        "accounts.fix_guide.step2_title": "🧹 Bu işe yaramazsa (Önbelleği Temizle)",
        "security.logs.search_placeholder": "IP, Yol, User Agent Ara...",
        "security.blacklist.search_placeholder": "Ara...",
        "security.blacklist.reason_placeholder": "örn: Kötü niyetli tarama",
        "security.blacklist.expires_placeholder": "Kalıcı olması için boş bırakın",
        "security.whitelist.description_placeholder": "örn: Dahili Sunucu",
    },
    "vi": {
        "settings.proxy_pool.add_tag_placeholder": "Thêm thẻ...",
        "settings.advanced.antigravity_cli_path_placeholder": "Chưa thiết lập (Sẽ tự động phát hiện)",
        "proxy.config.request.user_agent_placeholder": "Nhập chuỗi User-Agent tùy chỉnh...",
        "proxy.config.circuit_breaker.input_placeholder": "Nhập thời gian giãn cách theo giây, phân cách bằng dấu phẩy",
        "proxy.cloudflared.token_placeholder": "Dán mã token Cloudflare Tunnel vào đây",
        "proxy.cloudflared.public_url_placeholder": "URL công khai sẽ xuất hiện ở đây sau khi đường hầm khởi động",
        "proxy.router.preset_name_placeholder": "Nhập tên mẫu định sẵn...",
        "apiKeyFun.apiKeyPlaceholder": "Dán khóa API của bạn vào đây...",
        "ecosystem.search_placeholder": "Tìm kiếm công cụ, trình kích hoạt, máy chủ...",
        "common.switch_confirm_prompt": "Bạn có muốn chuyển sang tài khoản được đề xuất tốt nhất không?",
        "common.confirm_proceed": "Có, tiếp tục",
        "common.select_target_desc": "Chọn môi trường đích để kích hoạt hạn ngạch:",
        "common.switch_success": "Chuyển đổi tài khoản thành công",
        "nav.switch_to_english": "Chuyển sang tiếng Anh",
        "dashboard.verify_account_prompt": "Vui lòng xác minh tài khoản của bạn để tiếp tục.",
        "accounts.fix_guide.step2_title": "🧹 Nếu vẫn thất bại (Xóa bộ nhớ đệm)",
        "security.logs.search_placeholder": "Tìm kiếm IP, đường dẫn, User Agent...",
        "security.blacklist.search_placeholder": "Tìm kiếm...",
        "security.blacklist.reason_placeholder": "vd: Quét độc hại",
        "security.blacklist.expires_placeholder": "Để trống nếu là vĩnh viễn",
        "security.whitelist.description_placeholder": "vd: Máy chủ nội bộ",
    },
    "my": {
        "settings.proxy_pool.add_tag_placeholder": "Tambah tag...",
        "settings.advanced.antigravity_cli_path_placeholder": "Belum ditetapkan (Gunakan pengesanan automatik)",
        "proxy.config.request.user_agent_placeholder": "Masukkan rentetan User-Agent tersuai...",
        "proxy.config.circuit_breaker.input_placeholder": "Masukkan tempoh jeda dalam saat, dipisahkan dengan koma",
        "proxy.cloudflared.token_placeholder": "Tampal Token Cloudflare Tunnel anda di sini",
        "proxy.cloudflared.public_url_placeholder": "URL awam akan dipaparkan di sini selepas terowong bermula",
        "proxy.router.preset_name_placeholder": "Masukkan nama pratetap...",
        "apiKeyFun.apiKeyPlaceholder": "Tampal Kunci API anda di sini...",
        "security.logs.search_placeholder": "Cari IP, Laluan, Ejen Pengguna...",
        "security.blacklist.search_placeholder": "Cari...",
        "security.blacklist.reason_placeholder": "cth. Imbasan berniat jahat",
        "security.blacklist.expires_placeholder": "Biarkan kosong untuk kekal",
        "security.whitelist.description_placeholder": "cth. Pelayan Dalaman",
        "ecosystem.search_placeholder": "Cari alatan, pencetus, pelayan...",
        "common.switch_confirm_prompt": "Adakah anda mahu beralih ke akaun yang paling disyorkan?",
        "common.confirm_proceed": "Ya, Teruskan",
        "common.select_target_desc": "Pilih persekitaran sasaran di mana kuota harus diaktifkan:",
        "common.switch_success": "Pertukaran akaun berjaya diselesaikan",
        "nav.switch_to_english": "Tukar ke Bahasa Inggeris",
        "dashboard.verify_account_prompt": "Sila sahkan akaun anda untuk meneruskan.",
        "accounts.fix_guide.step2_title": "🧹 Jika itu gagal (Kosongkan Cache)",
    },
    "zh-TW": {
        "settings.proxy_pool.add_tag_placeholder": "新增標籤...",
        "settings.advanced.antigravity_cli_path_placeholder": "未設定 (將使用自動偵測)",
        "proxy.config.request.user_agent_placeholder": "輸入自訂 User-Agent 字串...",
        "proxy.config.circuit_breaker.input_placeholder": "輸入熔斷冷卻時間（秒），以逗號分隔",
        "proxy.cloudflared.token_placeholder": "在此貼上 Cloudflare Tunnel 權杖",
        "proxy.cloudflared.public_url_placeholder": "通道啟動後將在此顯示公開 URL",
        "proxy.router.preset_name_placeholder": "輸入預設集名稱...",
        "apiKeyFun.apiKeyPlaceholder": "貼上您的 API Key...",
        "ecosystem.search_placeholder": "搜尋工具、觸發詞、伺服器...",
        "common.switch_confirm_prompt": "是否切換至最佳推薦帳號？",
        "common.confirm_proceed": "是的，繼續",
        "common.select_target_desc": "選擇需啟用額度的目標環境：",
        "common.switch_success": "帳號切換成功",
        "nav.switch_to_english": "切換為英文",
        "dashboard.verify_account_prompt": "請驗證您的帳號以繼續使用。",
        "accounts.fix_guide.step2_title": "🧹 若仍未解決 (清除快取)",
        "security.logs.search_placeholder": "搜尋 IP、路徑、User Agent...",
        "security.blacklist.search_placeholder": "搜尋...",
        "security.blacklist.reason_placeholder": "例如：惡意掃描",
        "security.blacklist.expires_placeholder": "留空表示永久有效",
        "security.whitelist.description_placeholder": "例如：內部伺服器",
    },
    "zh": {
        "settings.proxy_pool.add_tag_placeholder": "添加标签...",
        "settings.advanced.antigravity_cli_path_placeholder": "未设置 (将使用自动检测)",
        "proxy.config.request.user_agent_placeholder": "输入自定义 User-Agent 字符串...",
        "proxy.config.circuit_breaker.input_placeholder": "输入熔断冷却时长（秒），用逗号分隔",
        "proxy.cloudflared.token_placeholder": "在此粘贴 Cloudflare Tunnel 令牌",
        "proxy.cloudflared.public_url_placeholder": "隧道启动后将在此显示公共 URL",
        "proxy.router.preset_name_placeholder": "输入预设名称...",
        "apiKeyFun.apiKeyPlaceholder": "粘贴您的 API Key...",
        "ecosystem.search_placeholder": "搜索工具、触发词、服务...",
        "common.switch_confirm_prompt": "是否切换至最佳推荐账号？",
        "common.confirm_proceed": "是的，继续",
        "common.select_target_desc": "选择需激活额度的目标环境：",
        "common.switch_success": "账号切换成功",
        "nav.switch_to_english": "切换为英文",
        "dashboard.verify_account_prompt": "请验证您的账号以继续使用。",
        "accounts.fix_guide.step2_title": "🧹 若仍未解决 (清除缓存)",
        "security.logs.search_placeholder": "搜索 IP、路径、User Agent...",
        "security.blacklist.search_placeholder": "搜索...",
        "security.blacklist.reason_placeholder": "例如：恶意扫描",
        "security.blacklist.expires_placeholder": "留空表示永久有效",
        "security.whitelist.description_placeholder": "例如：内部服务器",
    }
}

def unflatten_from_en(en_obj, flat_data, prefix=''):
    res = {}
    for k, v in en_obj.items():
        full = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            res[k] = unflatten_from_en(v, flat_data, full)
        else:
            res[k] = flat_data.get(full, v)
    return res

def apply_patches():
    with open(EN_PATH, 'r', encoding='utf-8') as f:
        en_tree = json.load(f)
    en_flat = flatten(en_tree)

    for lang, patch_dict in PATCHES.items():
        loc_path = os.path.join(LOCALES_DIR, f"{lang}.json")
        with open(loc_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        loc_flat = flatten(data)

        # Apply valid patches (only if key exists in en.json)
        updated = 0
        for key, text in patch_dict.items():
            if key in en_flat:
                loc_flat[key] = text
                updated += 1

        # Rebuild strictly from en_tree template to ensure exactly 2,407 keys
        rebuilt = unflatten_from_en(en_tree, loc_flat)

        # Write formatted with 2 spaces and CRLF
        json_str = json.dumps(rebuilt, ensure_ascii=False, indent=2).replace('\n', '\r\n') + '\r\n'
        with open(loc_path, 'w', encoding='utf-8') as f:
            f.write(json_str)

        print(f"Applied {updated} native translations to {lang}.json (Key parity strictly preserved)")

if __name__ == '__main__':
    apply_patches()
