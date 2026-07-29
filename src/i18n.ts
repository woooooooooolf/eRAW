export type ResolvedLocale = "en" | "zh-CN" | "zh-TW" | "ja" | "es" | "fr" | "de";
export type LanguagePreference = "system" | ResolvedLocale;

type MessageValues = Record<string, string | number | boolean>;
type Entry = Record<ResolvedLocale, string>;

const message = (
  en: string,
  zhCN: string,
  zhTW: string,
  ja: string,
  es: string,
  fr: string,
  de: string,
): Entry => ({ en, "zh-CN": zhCN, "zh-TW": zhTW, ja, es, fr, de });

const CATALOG = {
  "common.cancel": message("Cancel", "取消", "取消", "キャンセル", "Cancelar", "Annuler", "Abbrechen"),
  "common.apply": message("Apply", "应用", "套用", "適用", "Aplicar", "Appliquer", "Anwenden"),
  "common.done": message("Done", "完成", "完成", "完了", "Listo", "Terminé", "Fertig"),
  "common.close": message("Close", "关闭", "關閉", "閉じる", "Cerrar", "Fermer", "Schließen"),
  "common.error": message("Error", "错误", "錯誤", "エラー", "Error", "Erreur", "Fehler"),
  "common.warning": message("Warning", "警告", "警告", "警告", "Advertencia", "Avertissement", "Warnung"),
  "common.info": message("Information", "信息", "資訊", "情報", "Información", "Information", "Information"),
  "common.unknownError": message("Unknown error", "未知错误", "未知錯誤", "不明なエラー", "Error desconocido", "Erreur inconnue", "Unbekannter Fehler"),
  "common.planned": message("Planned", "规划中", "規劃中", "予定", "Planificado", "Planifié", "Geplant"),
  "common.standard": message("Standard", "标准", "標準", "標準", "Estándar", "Standard", "Standard"),
  "common.large": message("Large", "大", "大", "大", "Grande", "Grand", "Groß"),
  "common.extraLarge": message("Extra large", "特大", "特大", "特大", "Muy grande", "Très grand", "Sehr groß"),
  "common.left": message("Left", "左侧", "左側", "左", "Izquierda", "Gauche", "Links"),
  "common.right": message("Right", "右侧", "右側", "右", "Derecha", "Droite", "Rechts"),
  "common.auto": message("0 = Auto", "0 = 自动", "0 = 自動", "0 = 自動", "0 = Automático", "0 = Automatique", "0 = Automatisch"),
  "common.bilinear": message("Bilinear", "双线性", "雙線性", "バイリニア", "Bilineal", "Bilinéaire", "Bilinear"),

  "language.button": message("Interface language", "界面语言", "介面語言", "表示言語", "Idioma de la interfaz", "Langue de l’interface", "Oberflächensprache"),
  "language.menuTitle": message("Interface language", "界面语言", "介面語言", "表示言語", "Idioma de la interfaz", "Langue de l’interface", "Oberflächensprache"),
  "language.menuHint": message("Switch instantly and save automatically", "即时切换并自动保存", "立即切換並自動儲存", "すぐに切り替えて自動保存", "Cambio instantáneo y guardado automático", "Changement immédiat et enregistrement automatique", "Sofort wechseln und automatisch speichern"),
  "language.system": message("Follow system", "跟随系统", "跟隨系統", "システム設定に従う", "Seguir el sistema", "Suivre le système", "Systemeinstellung verwenden"),
  "language.current": message("Interface language: {language}", "界面语言：{language}", "介面語言：{language}", "表示言語：{language}", "Idioma de la interfaz: {language}", "Langue de l’interface : {language}", "Oberflächensprache: {language}"),

  "toolbar.open": message("Open", "打开", "開啟", "開く", "Abrir", "Ouvrir", "Öffnen"),
  "toolbar.closeFile": message("Close file", "关闭文件", "關閉檔案", "ファイルを閉じる", "Cerrar archivo", "Fermer le fichier", "Datei schließen"),
  "toolbar.export": message("Export", "导出", "匯出", "エクスポート", "Exportar", "Exporter", "Exportieren"),
  "toolbar.exportSelect": message("Select export content", "选择导出内容", "選擇匯出內容", "エクスポート内容を選択", "Seleccionar contenido de exportación", "Choisir le contenu à exporter", "Exportinhalt auswählen"),
  "toolbar.exportCurrent": message("Export current frame", "导出当前帧", "匯出目前影格", "現在のフレームをエクスポート", "Exportar fotograma actual", "Exporter l’image actuelle", "Aktuellen Frame exportieren"),
  "toolbar.exportSnapshot": message("Freeze current parameters and processing settings", "冻结当前参数与处理设置", "凍結目前參數與處理設定", "現在のパラメーターと処理設定を固定", "Fijar los parámetros y ajustes de procesamiento actuales", "Figer les paramètres et réglages de traitement actuels", "Aktuelle Parameter und Verarbeitungseinstellungen festhalten"),
  "toolbar.originalCfa": message("Original CFA", "原始 CFA", "原始 CFA", "元の CFA", "CFA original", "CFA d’origine", "Original-CFA"),
  "toolbar.originalCfaHint": message("Packing conversion, cropping and valid-pixel extraction", "Packing 转换、裁剪与有效像素提取", "Packing 轉換、裁切與有效像素擷取", "Packing 変換、クロップ、有効画素抽出", "Conversión de Packing, recorte y extracción de píxeles válidos", "Conversion du Packing, recadrage et extraction des pixels valides", "Packing-Konvertierung, Zuschnitt und Extraktion gültiger Pixel"),
  "toolbar.remosaicHint": message("Output standard Bayer using current Remosaic settings", "按当前 Remosaic 设置输出标准 Bayer", "依目前 Remosaic 設定輸出標準 Bayer", "現在の Remosaic 設定で標準 Bayer を出力", "Generar Bayer estándar con los ajustes actuales de Remosaic", "Produire un Bayer standard avec les réglages Remosaic actuels", "Standard-Bayer mit den aktuellen Remosaic-Einstellungen ausgeben"),
  "toolbar.demosaicHint": message("Output RGB48 Interleaved RAW", "输出 RGB48 Interleaved RAW", "輸出 RGB48 Interleaved RAW", "RGB48 Interleaved RAW を出力", "Generar RAW RGB48 Interleaved", "Produire un RAW RGB48 Interleaved", "RGB48 Interleaved RAW ausgeben"),
  "toolbar.displayModes": message("Display modes", "显示模式", "顯示模式", "表示モード", "Modos de visualización", "Modes d’affichage", "Anzeigemodi"),
  "toolbar.rawIntensity": message("RAW intensity", "RAW 强度", "RAW 強度", "RAW 強度", "Intensidad RAW", "Intensité RAW", "RAW-Intensität"),
  "toolbar.cfaMosaic": message("CFA mosaic", "CFA 点阵", "CFA 點陣", "CFA モザイク", "Mosaico CFA", "Mosaïque CFA", "CFA-Mosaik"),
  "toolbar.demosaicChannels": message("Demosaic RGB channels", "Demosaic RGB 通道", "Demosaic RGB 通道", "Demosaic RGB チャンネル", "Canales RGB Demosaic", "Canaux RGB Demosaic", "Demosaic-RGB-Kanäle"),
  "toolbar.redPlane": message("R plane", "R 平面", "R 平面", "R プレーン", "Plano R", "Plan R", "R-Ebene"),
  "toolbar.greenPlane": message("G plane", "G 平面", "G 平面", "G プレーン", "Plano G", "Plan G", "G-Ebene"),
  "toolbar.bluePlane": message("B plane", "B 平面", "B 平面", "B プレーン", "Plano B", "Plan B", "B-Ebene"),
  "toolbar.fit": message("Fit to window (Ctrl+0)", "适应窗口 (Ctrl+0)", "符合視窗 (Ctrl+0)", "ウィンドウに合わせる (Ctrl+0)", "Ajustar a la ventana (Ctrl+0)", "Adapter à la fenêtre (Ctrl+0)", "An Fenster anpassen (Ctrl+0)"),
  "toolbar.actual": message("Actual pixels (Ctrl+1)", "实际像素 (Ctrl+1)", "實際像素 (Ctrl+1)", "等倍表示 (Ctrl+1)", "Píxeles reales (Ctrl+1)", "Pixels réels (Ctrl+1)", "Tatsächliche Pixel (Ctrl+1)"),
  "toolbar.panel": message("Show or hide parameter panel", "显示或隐藏参数面板", "顯示或隱藏參數面板", "パラメーターパネルを表示／非表示", "Mostrar u ocultar el panel de parámetros", "Afficher ou masquer le panneau des paramètres", "Parameterbereich ein- oder ausblenden"),
  "toolbar.theme": message("Switch interface theme", "切换界面主题", "切換介面主題", "テーマを切り替え", "Cambiar tema de la interfaz", "Changer le thème de l’interface", "Oberflächendesign wechseln"),
  "toolbar.themeSelect": message("Select interface theme", "选择界面主题", "選擇介面主題", "テーマを選択", "Seleccionar tema de la interfaz", "Choisir le thème de l’interface", "Oberflächendesign auswählen"),
  "toolbar.themeTitle": message("Interface theme", "界面主题", "介面主題", "インターフェーステーマ", "Tema de la interfaz", "Thème de l’interface", "Oberflächendesign"),
  "toolbar.themeHint": message("Switch instantly and save automatically", "即时切换并自动保存", "立即切換並自動儲存", "すぐに切り替えて自動保存", "Cambio instantáneo y guardado automático", "Changement immédiat et enregistrement automatique", "Sofort wechseln und automatisch speichern"),
  "toolbar.settings": message("Settings", "设置", "設定", "設定", "Ajustes", "Paramètres", "Einstellungen"),
  "toolbar.helpAbout": message("Help and About", "帮助与关于", "說明與關於", "ヘルプとバージョン情報", "Ayuda y Acerca de", "Aide et À propos", "Hilfe und Info"),
  "toolbar.help": message("Help", "帮助", "說明", "ヘルプ", "Ayuda", "Aide", "Hilfe"),
  "toolbar.helpHint": message("The help center will be available in a later version", "帮助中心将在后续版本提供", "說明中心將於後續版本提供", "ヘルプセンターは今後のバージョンで提供予定です", "El centro de ayuda estará disponible en una versión posterior", "Le centre d’aide sera disponible dans une version ultérieure", "Das Hilfe-Center folgt in einer späteren Version"),
  "toolbar.shortcuts": message("Shortcuts", "快捷键", "快速鍵", "ショートカット", "Atajos", "Raccourcis", "Tastenkürzel"),
  "toolbar.shortcutsHint": message("View keyboard and canvas controls", "查看键盘与画布操作速查", "檢視鍵盤與畫布操作速查", "キーボードとキャンバス操作を確認", "Ver controles de teclado y lienzo", "Voir les commandes du clavier et du canevas", "Tastatur- und Arbeitsflächensteuerung anzeigen"),
  "toolbar.about": message("About", "关于", "關於", "バージョン情報", "Acerca de", "À propos", "Info"),
  "toolbar.aboutHint": message("Version, implementation and open-source components", "版本、实现者与开源组件", "版本、實作者與開源元件", "バージョン、実装、オープンソースコンポーネント", "Versión, implementación y componentes de código abierto", "Version, réalisation et composants open source", "Version, Implementierung und Open-Source-Komponenten"),
  "about.builtAt": message("Built {time}", "构建于 {time}", "建置於 {time}", "ビルド日時：{time}", "Compilado el {time}", "Compilé le {time}", "Erstellt am {time}"),

  "theme.darkOcean": message("Deep Ocean", "深海蓝", "深海藍", "ディープオーシャン", "Océano profundo", "Océan profond", "Tiefer Ozean"),
  "theme.darkViolet": message("Obsidian Violet", "曜石紫", "曜石紫", "オブシディアン・バイオレット", "Violeta obsidiana", "Violet obsidienne", "Obsidianviolett"),
  "theme.darkAmber": message("Amber Black", "琥珀黑", "琥珀黑", "アンバーブラック", "Negro ámbar", "Noir ambré", "Bernsteinschwarz"),
  "theme.lightFrost": message("Polar Blue", "极昼蓝", "極晝藍", "ポーラーブルー", "Azul polar", "Bleu polaire", "Polarblau"),
  "theme.lightMint": message("Mint White", "薄荷白", "薄荷白", "ミントホワイト", "Blanco menta", "Blanc menthe", "Mintweiß"),
  "theme.lightSand": message("Warm Sand", "暖砂白", "暖砂白", "ウォームサンド", "Arena cálida", "Sable chaud", "Warmer Sand"),
  "theme.dark": message("Dark", "深色", "深色", "ダーク", "Oscuro", "Sombre", "Dunkel"),
  "theme.light": message("Light", "浅色", "淺色", "ライト", "Claro", "Clair", "Hell"),

  "sidebar.imageFormat": message("Image format", "图像格式", "影像格式", "画像形式", "Formato de imagen", "Format d’image", "Bildformat"),
  "sidebar.dimensions": message("Valid resolution", "有效分辨率", "有效解析度", "有効解像度", "Resolución válida", "Résolution utile", "Gültige Auflösung"),
  "sidebar.validWidth": message("Valid width", "有效宽度", "有效寬度", "有効幅", "Anchura válida", "Largeur utile", "Gültige Breite"),
  "sidebar.validHeight": message("Valid height", "有效高度", "有效高度", "有効高さ", "Altura válida", "Hauteur utile", "Gültige Höhe"),
  "sidebar.bitDepth": message("Bit depth", "位深", "位元深度", "ビット深度", "Profundidad de bits", "Profondeur de bits", "Bittiefe"),
  "sidebar.storage": message("Storage format", "存储方式", "儲存方式", "格納形式", "Formato de almacenamiento", "Format de stockage", "Speicherformat"),
  "sidebar.endianness": message("Byte order", "字节序", "位元組順序", "バイトオーダー", "Orden de bytes", "Ordre des octets", "Byte-Reihenfolge"),
  "sidebar.bitAlignment": message("Valid-bit position", "有效位位置", "有效位元位置", "有効ビット位置", "Posición de bits válidos", "Position des bits utiles", "Position der gültigen Bits"),
  "sidebar.lowBits": message("Low bits LSB", "低位 LSB", "低位 LSB", "下位 LSB", "Bajo LSB", "Faible LSB", "LSB"),
  "sidebar.highBits": message("High bits MSB", "高位 MSB", "高位 MSB", "上位 MSB", "Alto MSB", "Fort MSB", "MSB"),
  "sidebar.cfaPattern": message("CFA pattern", "CFA 排列", "CFA 排列", "CFA 配列", "Patrón CFA", "Motif CFA", "CFA-Muster"),
  "sidebar.standardBayer": message("Standard Bayer", "标准 Bayer", "標準 Bayer", "標準 Bayer", "Bayer estándar", "Bayer standard", "Standard-Bayer"),
  "sidebar.processing": message("Image processing", "图像处理", "影像處理", "画像処理", "Procesamiento de imagen", "Traitement d’image", "Bildverarbeitung"),
  "sidebar.presentation": message("Image presentation", "画面呈现", "畫面呈現", "画面表示", "Presentación de imagen", "Présentation de l’image", "Bilddarstellung"),
  "sidebar.demosaicAlgorithm": message("Demosaic algorithm", "Demosaic 算法", "Demosaic 演算法", "Demosaic アルゴリズム", "Algoritmo Demosaic", "Algorithme Demosaic", "Demosaic-Algorithmus"),
  "sidebar.sameColor": message("Same-color bilinear reconstruction (high compute cost)", "同色双线性重建（高计算量）", "同色雙線性重建（高運算量）", "同色バイリニア再構成（高負荷）", "Reconstrucción bilineal del mismo color (alto coste de cálculo)", "Reconstruction bilinéaire de même couleur (calcul intensif)", "Bilineare Rekonstruktion gleicher Farben (rechenintensiv)"),
  "sidebar.layout": message("Row and frame layout", "行与帧布局", "列與影格配置", "行とフレームのレイアウト", "Diseño de filas y fotogramas", "Disposition des lignes et des images", "Zeilen- und Frame-Layout"),
  "sidebar.headerOffset": message("File header offset", "文件头偏移", "檔頭偏移", "ファイルヘッダーオフセット", "Desplazamiento de cabecera", "Décalage d’en-tête", "Dateikopf-Offset"),
  "sidebar.rowAlignment": message("Row alignment", "行对齐", "列對齊", "行アラインメント", "Alineación de fila", "Alignement de ligne", "Zeilenausrichtung"),
  "sidebar.rowStride": message("Explicit row stride", "显式行步长", "明確列步幅", "明示的な行ストライド", "Stride de fila explícito", "Pas de ligne explicite", "Expliziter Zeilen-Stride"),
  "sidebar.frameAlignment": message("Frame alignment", "帧对齐", "影格對齊", "フレームアラインメント", "Alineación de fotograma", "Alignement d’image", "Frame-Ausrichtung"),
  "sidebar.frameStride": message("Explicit frame stride", "显式帧步长", "明確影格步幅", "明示的なフレームストライド", "Stride de fotograma explícito", "Pas d’image explicite", "Expliziter Frame-Stride"),
  "sidebar.resize": message("Resize parameter panel", "调整参数面板宽度", "調整參數面板寬度", "パラメーターパネルの幅を変更", "Cambiar el ancho del panel de parámetros", "Redimensionner le panneau des paramètres", "Breite des Parameterbereichs ändern"),

  "empty.title": message("See the sensor’s true output", "查看传感器的真实输出", "檢視感測器的真實輸出", "センサーの実出力を表示", "Vea la salida real del sensor", "Observez la sortie réelle du capteur", "Die tatsächliche Sensorausgabe anzeigen"),
  "empty.description": message("Open a RAW file and configure dimensions, packing, CFA and alignment", "打开 RAW 文件，配置尺寸、packing、CFA 和对齐参数", "開啟 RAW 檔案並設定尺寸、packing、CFA 與對齊參數", "RAW ファイルを開き、サイズ、packing、CFA、アラインメントを設定", "Abra un archivo RAW y configure dimensiones, packing, CFA y alineación", "Ouvrez un fichier RAW et configurez les dimensions, le packing, le CFA et l’alignement", "RAW-Datei öffnen und Abmessungen, packing, CFA und Ausrichtung konfigurieren"),
  "empty.open": message("Open RAW image", "打开 RAW 图像", "開啟 RAW 影像", "RAW 画像を開く", "Abrir imagen RAW", "Ouvrir une image RAW", "RAW-Bild öffnen"),
  "empty.controls": message("Wheel to zoom · Left-drag to pan · Double-click to toggle fit/100%", "滚轮缩放 · 左键拖动 · 双击切换适应窗口/100%", "滾輪縮放 · 左鍵拖曳 · 雙擊切換符合視窗/100%", "ホイールでズーム · 左ドラッグで移動 · ダブルクリックでフィット/100%切替", "Rueda para zoom · Arrastre izquierdo para desplazar · Doble clic para ajustar/100%", "Molette pour zoomer · Glisser à gauche pour déplacer · Double-clic pour adapter/100 %", "Mausrad zum Zoomen · Linke Maustaste zum Verschieben · Doppelklick für Anpassen/100 %"),

  "diagnostics.title": message("Diagnostics", "诊断信息", "診斷資訊", "診断", "Diagnóstico", "Diagnostic", "Diagnose"),
  "diagnostics.waiting": message("Waiting for a file", "等待文件", "等待檔案", "ファイル待機中", "Esperando un archivo", "En attente d’un fichier", "Warten auf Datei"),
  "diagnostics.close": message("Close diagnostics panel", "关闭诊断面板", "關閉診斷面板", "診断パネルを閉じる", "Cerrar panel de diagnóstico", "Fermer le panneau de diagnostic", "Diagnosebereich schließen"),
  "diagnostics.openHint": message("Open a file to view layout diagnostics and runtime errors", "打开文件后显示布局诊断与运行时错误", "開啟檔案後顯示配置診斷與執行階段錯誤", "ファイルを開くとレイアウト診断と実行時エラーを表示します", "Abra un archivo para ver diagnósticos de diseño y errores de ejecución", "Ouvrez un fichier pour afficher les diagnostics de disposition et les erreurs d’exécution", "Datei öffnen, um Layout-Diagnosen und Laufzeitfehler anzuzeigen"),
  "diagnostics.button": message("Diagnostics", "诊断", "診斷", "診断", "Diagnóstico", "Diagnostic", "Diagnose"),
  "diagnostics.noFile": message("No file open", "未打开文件", "未開啟檔案", "ファイルが開かれていません", "No hay ningún archivo abierto", "Aucun fichier ouvert", "Keine Datei geöffnet"),
  "diagnostics.layout": message("Layout diagnostic", "布局诊断", "配置診斷", "レイアウト診断", "Diagnóstico de diseño", "Diagnostic de disposition", "Layout-Diagnose"),
  "diagnostics.runtime": message("Runtime error", "运行时错误", "執行階段錯誤", "実行時エラー", "Error de ejecución", "Erreur d’exécution", "Laufzeitfehler"),
  "diagnostics.normal": message("Parameters match the file layout; no issues found", "参数与文件布局匹配，未发现异常", "參數與檔案配置相符，未發現異常", "パラメーターとファイルレイアウトは一致しています", "Los parámetros coinciden con el diseño del archivo; no se encontraron problemas", "Les paramètres correspondent à la disposition du fichier ; aucun problème détecté", "Parameter entsprechen dem Dateilayout; keine Probleme gefunden"),
  "diagnostics.currentNormal": message("Current data layout is valid", "当前数据布局正常", "目前資料配置正常", "現在のデータレイアウトは正常です", "El diseño de datos actual es válido", "La disposition actuelle des données est valide", "Aktuelles Datenlayout ist gültig"),
  "diagnostics.issues": message("{count} item(s) need attention", "{count} 项需要注意", "{count} 項需要注意", "{count} 件の確認が必要です", "{count} elemento(s) requieren atención", "{count} élément(s) nécessitent votre attention", "{count} Element(e) erfordern Aufmerksamkeit"),
  "diagnostics.repeated": message("repeated {count} times", "重复 {count} 次", "重複 {count} 次", "{count} 回繰り返し", "repetido {count} veces", "répété {count} fois", "{count}-mal wiederholt"),
  "diagnostics.locate": message("Enter coordinates and locate a pixel", "输入坐标并定位像素", "輸入座標並定位像素", "座標を入力して画素を特定", "Introducir coordenadas y localizar un píxel", "Saisir les coordonnées et localiser un pixel", "Koordinaten eingeben und Pixel lokalisieren"),
  "diagnostics.zoom": message("Enter canvas zoom percentage", "输入画布缩放比例", "輸入畫布縮放比例", "キャンバスのズーム率を入力", "Introducir porcentaje de zoom del lienzo", "Saisir le pourcentage de zoom du canevas", "Zoom-Prozentsatz der Arbeitsfläche eingeben"),
  "frame.first": message("First frame", "第一帧", "第一影格", "先頭フレーム", "Primer fotograma", "Première image", "Erster Frame"),
  "frame.previous": message("Previous frame", "上一帧", "上一影格", "前のフレーム", "Fotograma anterior", "Image précédente", "Vorheriger Frame"),
  "frame.next": message("Next frame", "下一帧", "下一影格", "次のフレーム", "Fotograma siguiente", "Image suivante", "Nächster Frame"),
  "frame.last": message("Last frame", "最后一帧", "最後一影格", "最終フレーム", "Último fotograma", "Dernière image", "Letzter Frame"),

  "dialog.pixelTitle": message("Locate pixel", "定位像素", "定位像素", "画素を特定", "Localizar píxel", "Localiser un pixel", "Pixel lokalisieren"),
  "dialog.pixelEyebrow": message("PIXEL NAVIGATION", "像素导航", "像素導覽", "画素ナビゲーション", "NAVEGACIÓN DE PÍXELES", "NAVIGATION PAR PIXEL", "PIXELNAVIGATION"),
  "dialog.pixelDescription": message("Enter zero-based RAW pixel coordinates. The target pixel will be centered at maximum zoom.", "输入从 0 开始的 RAW 像素坐标。定位后将使用最大倍率，并把该像素置于画布中央。", "輸入從 0 開始的 RAW 像素座標。定位後將使用最大倍率並置於畫布中央。", "0 始まりの RAW 画素座標を入力します。最大倍率で対象画素を中央に表示します。", "Introduzca coordenadas de píxel RAW desde 0. El píxel se centrará con el zoom máximo.", "Saisissez les coordonnées RAW à partir de 0. Le pixel sera centré au zoom maximal.", "Nullbasierte RAW-Pixelkoordinaten eingeben. Das Zielpixel wird bei maximalem Zoom zentriert."),
  "dialog.xCoordinate": message("X coordinate", "X 坐标", "X 座標", "X 座標", "Coordenada X", "Coordonnée X", "X-Koordinate"),
  "dialog.yCoordinate": message("Y coordinate", "Y 坐标", "Y 座標", "Y 座標", "Coordenada Y", "Coordonnée Y", "Y-Koordinate"),
  "dialog.locateZoom": message("Locate and zoom", "定位并放大", "定位並放大", "特定して拡大", "Localizar y ampliar", "Localiser et agrandir", "Lokalisieren und vergrößern"),
  "dialog.zoomTitle": message("Set zoom", "设置缩放比例", "設定縮放比例", "ズーム率を設定", "Definir zoom", "Définir le zoom", "Zoom festlegen"),
  "dialog.zoomEyebrow": message("VIEWPORT SCALE", "视口缩放", "視埠縮放", "ビューポート倍率", "ESCALA DE VISTA", "ÉCHELLE DE LA VUE", "ANSICHTSSKALIERUNG"),
  "dialog.zoomDescription": message("Enter a canvas zoom percentage. Zoom is continuous and centered on the current view; RAW data and display mode are unchanged.", "输入画布缩放百分比。画布支持连续缩放，并以当前画布中心为锚点，不改变 RAW 数据或显示模式。", "輸入畫布縮放百分比。畫布支援連續縮放並以目前中心為錨點，不變更 RAW 資料或顯示模式。", "キャンバスのズーム率を入力します。現在の表示中心を基準に連続ズームし、RAW データや表示モードは変更しません。", "Introduzca el porcentaje de zoom. El zoom es continuo y se centra en la vista actual, sin cambiar los datos RAW ni el modo.", "Saisissez le pourcentage de zoom. Le zoom est continu et centré sur la vue actuelle, sans modifier les données RAW ni le mode.", "Zoom-Prozentsatz eingeben. Der Zoom ist kontinuierlich und auf die aktuelle Ansicht zentriert; RAW-Daten und Anzeigemodus bleiben unverändert."),
  "dialog.zoomRatio": message("Zoom", "缩放比例", "縮放比例", "ズーム", "Zoom", "Zoom", "Zoom"),
  "dialog.zoomContinuous": message("Continuous zoom is supported and the entered ratio will be applied", "支持连续缩放，将按输入比例应用", "支援連續縮放，將依輸入比例套用", "連続ズームに対応し、入力した倍率を適用します", "Se admite zoom continuo y se aplicará la proporción introducida", "Le zoom continu est pris en charge et la valeur saisie sera appliquée", "Kontinuierlicher Zoom wird unterstützt; der eingegebene Wert wird angewendet"),
  "dialog.applyZoom": message("Apply zoom", "应用缩放", "套用縮放", "ズームを適用", "Aplicar zoom", "Appliquer le zoom", "Zoom anwenden"),

  "settings.eyebrow": message("APPLICATION PREFERENCES", "应用偏好设置", "應用程式偏好設定", "アプリケーション設定", "PREFERENCIAS DE LA APLICACIÓN", "PRÉFÉRENCES DE L’APPLICATION", "ANWENDUNGSEINSTELLUNGEN"),
  "settings.title": message("Settings", "设置", "設定", "設定", "Ajustes", "Paramètres", "Einstellungen"),
  "settings.appearance": message("Appearance", "外观", "外觀", "外観", "Apariencia", "Apparence", "Darstellung"),
  "settings.appearanceHint": message("Adjust interface text and motion without changing RAW image scale.", "调整界面文字与动态效果，不改变 RAW 图像的显示比例。", "調整介面文字與動態效果，不變更 RAW 影像顯示比例。", "RAW 画像の表示倍率を変えずに文字と動きを調整します。", "Ajuste el texto y el movimiento sin cambiar la escala de la imagen RAW.", "Ajustez le texte et les animations sans modifier l’échelle de l’image RAW.", "Text und Bewegung anpassen, ohne den RAW-Bildmaßstab zu ändern."),
  "settings.fontSize": message("Interface font size", "界面字号", "介面字級", "文字サイズ", "Tamaño de fuente", "Taille de police", "Schriftgröße"),
  "settings.fontHint": message("Large or extra large is recommended for high-resolution displays", "高分辨率显示器推荐使用“大”或“特大”", "高解析度顯示器建議使用「大」或「特大」", "高解像度ディスプレイでは「大」または「特大」を推奨", "Se recomienda grande o muy grande para pantallas de alta resolución", "Grand ou très grand est recommandé pour les écrans haute résolution", "Groß oder sehr groß wird für hochauflösende Displays empfohlen"),
  "settings.sidebarPosition": message("Parameter panel position", "参数栏位置", "參數欄位置", "パラメーターパネルの位置", "Posición del panel de parámetros", "Position du panneau des paramètres", "Position des Parameterbereichs"),
  "settings.sidebarHint": message("Place image format and layout parameters on the left or right", "将图像格式和布局参数放在窗口左侧或右侧", "將影像格式與配置參數置於視窗左側或右側", "画像形式とレイアウトのパラメーターを左右に配置", "Coloque los parámetros de formato y diseño a la izquierda o derecha", "Placez les paramètres de format et de disposition à gauche ou à droite", "Bildformat- und Layoutparameter links oder rechts platzieren"),
  "settings.reduceMotion": message("Reduce motion", "减少动态效果", "減少動態效果", "動きを減らす", "Reducir movimiento", "Réduire les animations", "Bewegung reduzieren"),
  "settings.reduceMotionHint": message("Disable panel, dialog and notification transitions", "关闭面板、弹窗和提示的过渡动画", "關閉面板、對話框與提示的轉場動畫", "パネル、ダイアログ、通知のアニメーションを無効化", "Desactivar transiciones de paneles, diálogos y avisos", "Désactiver les transitions des panneaux, dialogues et notifications", "Übergänge von Bereichen, Dialogen und Hinweisen deaktivieren"),
  "settings.operation": message("Operation", "操作", "操作", "操作", "Operación", "Utilisation", "Bedienung"),
  "settings.operationHint": message("Control default file-opening and canvas interaction behavior.", "控制打开文件和画布交互的默认行为。", "控制開啟檔案與畫布互動的預設行為。", "ファイルを開くときとキャンバス操作の既定動作を設定します。", "Controle el comportamiento predeterminado al abrir archivos y usar el lienzo.", "Contrôlez le comportement par défaut à l’ouverture et sur le canevas.", "Standardverhalten beim Öffnen von Dateien und bei der Arbeitsflächeninteraktion steuern."),
  "settings.onOpen": message("When opening an image", "打开图像时", "開啟影像時", "画像を開くとき", "Al abrir una imagen", "À l’ouverture d’une image", "Beim Öffnen eines Bildes"),
  "settings.onOpenHint": message("Choose the initial zoom for a new file", "决定新文件的初始缩放方式", "決定新檔案的初始縮放方式", "新しいファイルの初期ズームを選択", "Elegir el zoom inicial de un archivo nuevo", "Choisir le zoom initial d’un nouveau fichier", "Anfangszoom für eine neue Datei auswählen"),
  "settings.fit": message("Fit to window", "适应窗口", "符合視窗", "ウィンドウに合わせる", "Ajustar a la ventana", "Adapter à la fenêtre", "An Fenster anpassen"),
  "settings.actual": message("100% actual pixels", "100% 实际像素", "100% 實際像素", "100% 等倍表示", "100% píxeles reales", "100 % pixels réels", "100 % tatsächliche Pixel"),
  "settings.wheelSpeed": message("Wheel zoom speed", "滚轮缩放速度", "滾輪縮放速度", "ホイールズーム速度", "Velocidad de zoom con rueda", "Vitesse de zoom à la molette", "Zoomgeschwindigkeit des Mausrads"),
  "settings.wheelHint": message("Zoom always centers on the image position under the pointer", "缩放始终以鼠标指向的图像位置为中心", "縮放始終以滑鼠指向的影像位置為中心", "ポインター位置を中心にズームします", "El zoom siempre se centra bajo el puntero", "Le zoom reste centré sous le pointeur", "Zoom wird immer auf die Bildposition unter dem Zeiger zentriert"),
  "settings.gentle": message("Gentle", "柔和", "柔和", "緩やか", "Suave", "Doux", "Sanft"),
  "settings.fast": message("Fast", "快速", "快速", "高速", "Rápido", "Rapide", "Schnell"),
  "settings.remember": message("Remember RAW parameters", "记住 RAW 参数", "記住 RAW 參數", "RAW パラメーターを記憶", "Recordar parámetros RAW", "Mémoriser les paramètres RAW", "RAW-Parameter merken"),
  "settings.rememberHint": message("Restore dimensions, packing, CFA and alignment on next launch", "下次启动时恢复尺寸、packing、CFA 和对齐配置", "下次啟動時還原尺寸、packing、CFA 與對齊設定", "次回起動時にサイズ、packing、CFA、アラインメントを復元", "Restaurar dimensiones, packing, CFA y alineación en el próximo inicio", "Restaurer les dimensions, le packing, le CFA et l’alignement au prochain démarrage", "Abmessungen, packing, CFA und Ausrichtung beim nächsten Start wiederherstellen"),
  "settings.channelRendering": message("RGB channel rendering", "RGB 通道渲染", "RGB 通道渲染", "RGB チャンネル表示", "Renderizado de canales RGB", "Rendu des canaux RGB", "RGB-Kanaldarstellung"),
  "settings.channelRenderingHint": message("Changes only the tint of R/G/B channel views; reconstructed DN and exported data remain unchanged", "仅改变 R/G/B 通道视图的着色，不改变重建 DN 或导出数据", "僅變更 R/G/B 通道檢視的著色，不改變重建 DN 或匯出資料", "R/G/B チャンネル表示の着色のみを変更し、再構成 DN やエクスポートデータは変更しません", "Solo cambia el color de las vistas de canal R/G/B; no modifica el DN reconstruido ni los datos exportados", "Modifie uniquement la teinte des vues de canal R/G/B, sans changer le DN reconstruit ni les données exportées", "Ändert nur die Färbung der R/G/B-Kanalansichten; rekonstruierte DN und exportierte Daten bleiben unverändert"),
  "settings.channelColor": message("Channel color", "通道颜色", "通道色彩", "チャンネルカラー", "Color del canal", "Couleur du canal", "Kanalfarbe"),
  "settings.channelGrayscale": message("Grayscale (intensity only)", "灰度（仅强度）", "灰階（僅強度）", "グレースケール（強度のみ）", "Escala de grises (solo intensidad)", "Niveaux de gris (intensité uniquement)", "Graustufen (nur Intensität)"),
  "settings.showPixelValues": message("Show pixel values at high zoom", "高倍率显示像素值", "高倍率顯示像素值", "高倍率で画素値を表示", "Mostrar valores de píxel con zoom alto", "Afficher les valeurs de pixel à fort zoom", "Pixelwerte bei starker Vergrößerung anzeigen"),
  "settings.showPixelValuesHint": message("RAW intensity and Bayer mosaic always show original DN", "RAW 强度与 Bayer 点阵始终显示原始 DN", "RAW 強度與 Bayer 點陣始終顯示原始 DN", "RAW 強度と Bayer モザイクは常に元の DN を表示", "La intensidad RAW y el mosaico Bayer siempre muestran el DN original", "L’intensité RAW et la mosaïque Bayer affichent toujours le DN d’origine", "RAW-Intensität und Bayer-Mosaik zeigen immer den ursprünglichen DN"),
  "settings.demosaicValues": message("Demosaic value content", "Demosaic 数值内容", "Demosaic 數值內容", "Demosaic 値の内容", "Contenido de valores Demosaic", "Contenu des valeurs Demosaic", "Demosaic-Wertinhalt"),
  "settings.demosaicValuesHint": message("RGB components are interpolated in the original bit-depth range, not 8-bit display values", "RGB 为原始位深范围内的插值分量，不是 8-bit 显示值", "RGB 為原始位元深度範圍內的插值分量，並非 8-bit 顯示值", "RGB は元のビット深度範囲で補間した成分で、8-bit 表示値ではありません", "Los componentes RGB se interpolan en el rango de bits original, no son valores de pantalla de 8 bits", "Les composantes RGB sont interpolées dans la plage de profondeur d’origine, pas en valeurs d’affichage 8 bits", "RGB-Komponenten werden im ursprünglichen Bittiefenbereich interpoliert und sind keine 8-Bit-Anzeigewerte"),
  "settings.rawDn": message("Original DN", "原始 DN", "原始 DN", "元の DN", "DN original", "DN d’origine", "Ursprünglicher DN"),
  "settings.interpolatedRgb": message("Three-line interpolated RGB", "三行插值 RGB", "三行插值 RGB", "3 行の補間 RGB", "RGB interpolado en tres líneas", "RGB interpolé sur trois lignes", "Interpoliertes RGB in drei Zeilen"),
  "presentation.missingAppearance": message("Missing-data appearance", "缺失数据外观", "缺失資料外觀", "欠損データの表示", "Aspecto de datos ausentes", "Apparence des données manquantes", "Darstellung fehlender Daten"),
  "presentation.missingAppearanceHint": message("Changes only pixels that cannot be read from the file preview; export fill values are unchanged", "只改变预览中无法从文件读取的像素，不改变导出填充值", "只變更預覽中無法從檔案讀取的像素，不變更匯出填充值", "ファイルから読み取れないプレビュー画素のみを変更し、エクスポートの補完値は変更しません", "Solo cambia los píxeles de la vista previa que no se pueden leer; no altera los valores de relleno de exportación", "Modifie uniquement les pixels d’aperçu illisibles dans le fichier, sans changer les valeurs de remplissage à l’export", "Ändert nur Vorschaupixel, die nicht aus der Datei gelesen werden können; Export-Füllwerte bleiben unverändert"),
  "presentation.darkCheckerboard": message("Dark checkerboard", "深色棋盘格", "深色棋盤格", "暗い市松模様", "Tablero oscuro", "Damier sombre", "Dunkles Schachbrett"),
  "presentation.lightCheckerboard": message("Light checkerboard", "浅色棋盘格", "淺色棋盤格", "明るい市松模様", "Tablero claro", "Damier clair", "Helles Schachbrett"),
  "presentation.solid": message("Solid color", "纯色", "純色", "単色", "Color sólido", "Couleur unie", "Einfarbig"),
  "presentation.solidColor": message("Solid color value", "纯色颜色", "純色色彩", "単色の色", "Valor del color sólido", "Valeur de la couleur unie", "Einfarbiger Farbwert"),
  "settings.performance": message("Performance", "性能", "效能", "パフォーマンス", "Rendimiento", "Performances", "Leistung"),
  "settings.performanceHint": message("A larger GPU cache reduces tile reloads when panning very large images.", "更大的 GPU 缓存可减少超大图像来回拖动时的瓦片重载。", "較大的 GPU 快取可減少拖曳超大影像時的圖塊重新載入。", "大きな GPU キャッシュは巨大画像を移動するときのタイル再読込を減らします。", "Una caché GPU mayor reduce la recarga de mosaicos en imágenes muy grandes.", "Un cache GPU plus grand réduit le rechargement des tuiles sur les très grandes images.", "Ein größerer GPU-Cache reduziert das Nachladen von Kacheln bei sehr großen Bildern."),
  "settings.gpuCache": message("GPU tile cache", "GPU 瓦片缓存", "GPU 圖塊快取", "GPU タイルキャッシュ", "Caché de mosaicos GPU", "Cache de tuiles GPU", "GPU-Kachelcache"),
  "settings.gpuCacheHint": message("Caches preview textures only; the full RAW file is not copied", "只缓存预览纹理，不复制完整 RAW 文件", "僅快取預覽紋理，不複製完整 RAW 檔案", "プレビューテクスチャのみをキャッシュし、RAW 全体はコピーしません", "Solo almacena texturas de vista previa; no copia el archivo RAW completo", "Met uniquement les textures d’aperçu en cache, sans copier le fichier RAW complet", "Speichert nur Vorschautexturen; die vollständige RAW-Datei wird nicht kopiert"),
  "settings.recommended": message("64 MiB (recommended)", "64 MiB（推荐）", "64 MiB（建議）", "64 MiB（推奨）", "64 MiB (recomendado)", "64 Mio (recommandé)", "64 MiB (empfohlen)"),
  "settings.reset": message("Restore defaults", "恢复默认设置", "還原預設設定", "既定値に戻す", "Restaurar valores predeterminados", "Rétablir les valeurs par défaut", "Standardeinstellungen wiederherstellen"),
  "settings.saved": message("Settings saved", "设置已保存", "設定已儲存", "設定を保存しました", "Ajustes guardados", "Paramètres enregistrés", "Einstellungen gespeichert"),
  "help.dimensions": message("Visible pixel width and height, excluding row or frame padding. The current range is 1×1 to {max}×{max}.", "图像中可见的有效像素宽度和高度，不包含每行或每帧末尾的填充数据。当前前端允许范围为 1×1 至 {max}×{max}。", "影像中可見的有效像素寬度與高度，不含每列或每影格末尾的填充資料。目前範圍為 1×1 至 {max}×{max}。", "行末・フレーム末のパディングを除く可視画素の幅と高さです。現在の範囲は 1×1～{max}×{max} です。", "Anchura y altura de píxeles visibles, sin relleno de fila o fotograma. Rango actual: 1×1 a {max}×{max}.", "Largeur et hauteur des pixels visibles, hors remplissage de ligne ou d’image. Plage actuelle : 1×1 à {max}×{max}.", "Sichtbare Pixelbreite und -höhe ohne Zeilen- oder Frame-Padding. Aktueller Bereich: 1×1 bis {max}×{max}."),
  "help.bitDepth": message("Effective bits used per pixel. 9/11/13/15-bit data is usually stored in a 16-bit container.", "每个像素实际使用的有效位数。9/11/13/15 bit 数据通常存放在 16-bit 容器中。", "每個像素實際使用的有效位元數。9/11/13/15 bit 資料通常存於 16-bit 容器中。", "画素ごとの有効ビット数です。9/11/13/15 bit データは通常 16-bit コンテナに格納されます。", "Bits efectivos por píxel. Los datos de 9/11/13/15 bits suelen almacenarse en un contenedor de 16 bits.", "Nombre de bits utiles par pixel. Les données 9/11/13/15 bits sont généralement stockées dans un conteneur 16 bits.", "Effektive Bits pro Pixel. 9/11/13/15-Bit-Daten werden meist in einem 16-Bit-Container gespeichert."),
  "help.packing": message("Byte layout of RAW pixels in the file; MIPI formats pack multiple pixels compactly.", "RAW 像素在文件中的字节排列方式；MIPI 格式会将多个像素紧凑打包。", "RAW 像素在檔案中的位元組排列方式；MIPI 格式會緊密打包多個像素。", "ファイル内の RAW 画素のバイト配置です。MIPI 形式は複数画素を密にパックします。", "Disposición de bytes de los píxeles RAW; los formatos MIPI empaquetan varios píxeles.", "Disposition des octets des pixels RAW ; les formats MIPI regroupent plusieurs pixels.", "Byte-Anordnung der RAW-Pixel; MIPI-Formate packen mehrere Pixel kompakt."),
  "help.endianness": message("Byte order for multi-byte Unpacked pixels; MIPI packed formats do not use this setting.", "Unpacked 多字节像素在文件中的字节顺序；MIPI packed 格式不使用此设置。", "Unpacked 多位元組像素的位元組順序；MIPI packed 格式不使用此設定。", "複数バイト Unpacked 画素のバイト順です。MIPI packed 形式では使用しません。", "Orden de bytes para píxeles Unpacked multibyte; MIPI packed no usa este ajuste.", "Ordre des octets des pixels Unpacked multi-octets ; MIPI packed n’utilise pas ce réglage.", "Byte-Reihenfolge mehrbyteiger Unpacked-Pixel; MIPI packed verwendet diese Einstellung nicht."),
  "help.bitAlignment": message("Whether valid pixel bits occupy the low or high end of an Unpacked container.", "有效像素位在 Unpacked 容器中靠低位或靠高位存放。", "有效像素位元存於 Unpacked 容器的低位或高位。", "有効画素ビットを Unpacked コンテナの下位または上位に配置します。", "Indica si los bits válidos ocupan la parte baja o alta del contenedor Unpacked.", "Indique si les bits utiles occupent la partie basse ou haute du conteneur Unpacked.", "Legt fest, ob gültige Pixelbits im unteren oder oberen Bereich des Unpacked-Containers liegen."),
  "help.cfa": message("Sensor color filter array. Quad CFA has a 4×4 period with each color arranged in 2×2 blocks.", "传感器彩色滤光阵列；Quad CFA 使用 4×4 周期，每种颜色以 2×2 同色块排列。", "感測器彩色濾光陣列；Quad CFA 採 4×4 週期，每種顏色以 2×2 同色區塊排列。", "センサーのカラーフィルター配列です。Quad CFA は 4×4 周期で各色を 2×2 ブロックに配置します。", "Matriz de filtros de color del sensor. Quad CFA usa un período 4×4 con bloques 2×2 del mismo color.", "Matrice de filtres colorés du capteur. Quad CFA utilise une période 4×4 avec des blocs 2×2 de même couleur.", "Farbfilterarray des Sensors. Quad CFA nutzt eine 4×4-Periode mit 2×2-Blöcken gleicher Farbe."),
  "help.cfaPhase": message("X/Y offset of file coordinate (0,0) from the selected Quad CFA 4×4 reference, from 0 to 3.", "文件坐标 (0,0) 相对于所选 Quad CFA 基准 4×4 阵列的 X/Y 偏移，范围均为 0–3。", "檔案座標 (0,0) 相對於所選 Quad CFA 基準 4×4 陣列的 X/Y 偏移，範圍為 0–3。", "ファイル座標 (0,0) と選択した Quad CFA 基準 4×4 配列との X/Y オフセット（0～3）です。", "Desplazamiento X/Y de la coordenada (0,0) respecto a la referencia Quad CFA 4×4, de 0 a 3.", "Décalage X/Y de la coordonnée (0,0) par rapport à la référence Quad CFA 4×4, de 0 à 3.", "X/Y-Offset der Dateikoordinate (0,0) zur gewählten Quad-CFA-4×4-Referenz, 0 bis 3."),
  "help.headerOffset": message("Byte offset from the beginning of the file to the first frame’s RAW pixel data.", "第一帧 RAW 像素数据相对于文件开头的字节偏移。", "第一影格 RAW 像素資料相對於檔案開頭的位元組偏移。", "ファイル先頭から最初のフレームの RAW 画素データまでのバイトオフセットです。", "Desplazamiento en bytes desde el inicio del archivo hasta los datos RAW del primer fotograma.", "Décalage en octets entre le début du fichier et les données RAW de la première image.", "Byte-Offset vom Dateianfang zu den RAW-Pixeldaten des ersten Frames."),
  "help.rowAlignment": message("Byte alignment used for automatic row stride; applies only when explicit row stride is 0.", "自动行步长使用的字节对齐值；仅在显式行步长为 0 时生效。", "自動列步幅使用的位元組對齊值；僅在明確列步幅為 0 時生效。", "自動行ストライドのバイトアラインメントです。明示的な行ストライドが 0 の場合のみ有効です。", "Alineación en bytes del stride automático de fila; solo se aplica si el stride explícito es 0.", "Alignement en octets du pas de ligne automatique ; actif uniquement si le pas explicite vaut 0.", "Byte-Ausrichtung für automatischen Zeilen-Stride; nur bei explizitem Zeilen-Stride 0."),
  "help.rowStride": message("Byte distance between adjacent row starts; 0 computes it from row size and alignment.", "相邻两行起点之间的字节距离；0 表示根据有效行大小和行对齐自动计算。", "相鄰兩列起點間的位元組距離；0 表示依有效列大小與對齊自動計算。", "隣接する行の開始位置間のバイト距離です。0 なら行サイズとアラインメントから自動計算します。", "Distancia en bytes entre filas; 0 la calcula desde el tamaño y la alineación.", "Distance en octets entre les débuts de ligne ; 0 la calcule selon la taille et l’alignement.", "Byte-Abstand zwischen Zeilenanfängen; 0 berechnet ihn aus Zeilengröße und Ausrichtung."),
  "help.frameAlignment": message("Byte alignment used for automatic frame stride; applies only when explicit frame stride is 0.", "自动帧步长使用的字节对齐值；仅在显式帧步长为 0 时生效。", "自動影格步幅使用的位元組對齊值；僅在明確影格步幅為 0 時生效。", "自動フレームストライドのバイトアラインメントです。明示的な値が 0 の場合のみ有効です。", "Alineación en bytes del stride automático de fotograma; solo si el explícito es 0.", "Alignement en octets du pas d’image automatique ; actif uniquement si le pas explicite vaut 0.", "Byte-Ausrichtung für automatischen Frame-Stride; nur bei explizitem Frame-Stride 0."),
  "help.frameStride": message("Byte distance between adjacent frame starts; 0 computes it from frame size and alignment.", "相邻两帧起点之间的字节距离；0 表示根据帧数据大小和帧对齐自动计算。", "相鄰兩影格起點間的位元組距離；0 表示依影格資料大小與對齊自動計算。", "隣接フレームの開始位置間のバイト距離です。0 ならフレームサイズとアラインメントから自動計算します。", "Distancia en bytes entre fotogramas; 0 la calcula desde el tamaño y la alineación.", "Distance en octets entre les débuts d’image ; 0 la calcule selon la taille et l’alignement.", "Byte-Abstand zwischen Frame-Anfängen; 0 berechnet ihn aus Frame-Größe und Ausrichtung."),
  "help.decrease": message("Decrease {label}", "减小{label}", "減小{label}", "{label} を減らす", "Reducir {label}", "Diminuer {label}", "{label} verringern"),
  "help.increase": message("Increase {label}", "增大{label}", "增大{label}", "{label} を増やす", "Aumentar {label}", "Augmenter {label}", "{label} erhöhen"),

  "shortcuts.eyebrow": message("KEYBOARD & CANVAS REFERENCE", "键盘与画布速查", "鍵盤與畫布速查", "キーボードとキャンバス操作", "REFERENCIA DE TECLADO Y LIENZO", "RÉFÉRENCE CLAVIER ET CANEVAS", "TASTATUR- UND ARBEITSFLÄCHENREFERENZ"),
  "shortcuts.fileView": message("File and view", "文件与视图", "檔案與檢視", "ファイルと表示", "Archivo y vista", "Fichier et affichage", "Datei und Ansicht"),
  "shortcuts.openRaw": message("Open RAW file", "打开 RAW 文件", "開啟 RAW 檔案", "RAW ファイルを開く", "Abrir archivo RAW", "Ouvrir un fichier RAW", "RAW-Datei öffnen"),
  "shortcuts.closeRaw": message("Close current RAW file", "关闭当前 RAW 文件", "關閉目前的 RAW 檔案", "現在の RAW ファイルを閉じる", "Cerrar el archivo RAW actual", "Fermer le fichier RAW actuel", "Aktuelle RAW-Datei schließen"),
  "shortcuts.exportFrame": message("Export current frame", "导出当前帧", "匯出目前影格", "現在のフレームをエクスポート", "Exportar fotograma actual", "Exporter l’image actuelle", "Aktuellen Frame exportieren"),
  "shortcuts.fit": message("Fit to window", "适应窗口", "符合視窗", "ウィンドウに合わせる", "Ajustar a la ventana", "Adapter à la fenêtre", "An Fenster anpassen"),
  "shortcuts.actual": message("100% actual pixels", "100% 实际像素", "100% 實際像素", "100% 等倍表示", "100% píxeles reales", "100 % pixels réels", "100 % tatsächliche Pixel"),
  "shortcuts.fullscreen": message("Toggle fullscreen", "切换全屏", "切換全螢幕", "全画面を切り替え", "Alternar pantalla completa", "Basculer en plein écran", "Vollbild umschalten"),
  "shortcuts.canvas": message("Canvas controls", "画布操作", "畫布操作", "キャンバス操作", "Controles del lienzo", "Commandes du canevas", "Arbeitsflächensteuerung"),
  "shortcuts.pointerZoom": message("Continuous zoom at pointer", "以指针位置连续缩放", "以指標位置連續縮放", "ポインター位置で連続ズーム", "Zoom continuo en el puntero", "Zoom continu sous le pointeur", "Kontinuierlich am Zeiger zoomen"),
  "shortcuts.wheel": message("Wheel", "滚轮", "滾輪", "ホイール", "Rueda", "Molette", "Mausrad"),
  "shortcuts.pan": message("Pan image", "平移图像", "平移影像", "画像を移動", "Desplazar imagen", "Déplacer l’image", "Bild verschieben"),
  "shortcuts.leftDrag": message("Left-drag", "左键拖动", "左鍵拖曳", "左ドラッグ", "Arrastre izquierdo", "Glisser à gauche", "Links ziehen"),
  "shortcuts.toggleFit": message("Toggle fit / 100%", "切换适应窗口 / 100%", "切換符合視窗 / 100%", "フィット / 100% を切り替え", "Alternar ajustar / 100%", "Basculer adapter / 100 %", "Anpassen / 100 % umschalten"),
  "shortcuts.doubleClick": message("Double-click", "双击", "雙擊", "ダブルクリック", "Doble clic", "Double-clic", "Doppelklick"),
  "shortcuts.closeMenus": message("Close menu or diagnostics panel", "关闭菜单或诊断面板", "關閉選單或診斷面板", "メニューまたは診断パネルを閉じる", "Cerrar menú o panel de diagnóstico", "Fermer le menu ou le panneau de diagnostic", "Menü oder Diagnosebereich schließen"),
  "shortcuts.parameters": message("Parameter input", "参数输入", "參數輸入", "パラメーター入力", "Entrada de parámetros", "Saisie des paramètres", "Parametereingabe"),
  "shortcuts.submitLeave": message("Submit current input and leave", "提交当前输入并离开", "提交目前輸入並離開", "現在の入力を確定して離れる", "Enviar entrada actual y salir", "Valider la saisie et quitter", "Aktuelle Eingabe übernehmen und verlassen"),
  "shortcuts.submitNext": message("Submit and move to next item", "提交并切换到下一项", "提交並切換至下一項", "確定して次の項目へ移動", "Enviar y pasar al siguiente elemento", "Valider et passer à l’élément suivant", "Übernehmen und zum nächsten Element wechseln"),

  "about.lab": message("RAW SENSOR LAB", "RAW 传感器实验室", "RAW 感測器實驗室", "RAW センサーラボ", "LABORATORIO DE SENSORES RAW", "LABORATOIRE DE CAPTEURS RAW", "RAW-SENSORLABOR"),
  "about.productDesign": message("Product design", "产品设计", "產品設計", "プロダクトデザイン", "Diseño de producto", "Conception du produit", "Produktdesign"),
  "about.engineering": message("Engineering", "工程实现", "工程實作", "実装", "Implementación", "Réalisation", "Implementierung"),
  "about.components": message("Open-source components", "开源组件", "開源元件", "オープンソースコンポーネント", "Componentes de código abierto", "Composants open source", "Open-Source-Komponenten"),
  "about.componentsHint": message("View major third-party components and license information", "查看主要第三方组件与许可证信息", "檢視主要第三方元件與授權資訊", "主なサードパーティコンポーネントとライセンスを表示", "Ver principales componentes de terceros y licencias", "Voir les principaux composants tiers et leurs licences", "Wichtige Drittanbieterkomponenten und Lizenzinformationen anzeigen"),
  "about.componentsEyebrow": message("OPEN SOURCE ACKNOWLEDGEMENTS", "开源致谢", "開源致謝", "オープンソース謝辞", "AGRADECIMIENTOS DE CÓDIGO ABIERTO", "REMERCIEMENTS OPEN SOURCE", "OPEN-SOURCE-DANKSAGUNGEN"),
  "about.componentsTitle": message("Major open-source components", "主要开源组件", "主要開源元件", "主なオープンソースコンポーネント", "Principales componentes de código abierto", "Principaux composants open source", "Wichtige Open-Source-Komponenten"),
  "about.componentsIntro": message("eRAW uses the following major open-source components. Copyright belongs to their respective owners and use follows each license. This summary does not replace the full license text.", "eRAW 使用以下主要开源组件。组件版权归各自权利人所有，使用与再分发遵循其各自许可证。本页用于快速查阅，不替代组件附带的完整许可文本。", "eRAW 使用以下主要開源元件。版權歸各權利人所有，使用與再散布遵循各自授權。本頁僅供快速查閱，不取代完整授權文字。", "eRAW は以下の主なオープンソースコンポーネントを使用しています。著作権と利用条件は各ライセンスに従います。この概要は完全なライセンス文書に代わるものではありません。", "eRAW usa los siguientes componentes de código abierto. Los derechos pertenecen a sus propietarios y el uso sigue cada licencia. Este resumen no sustituye los textos completos.", "eRAW utilise les composants open source suivants. Les droits appartiennent à leurs titulaires et l’utilisation suit chaque licence. Ce résumé ne remplace pas les textes complets.", "eRAW verwendet die folgenden Open-Source-Komponenten. Rechte liegen bei den jeweiligen Inhabern; die Nutzung folgt den Lizenzen. Diese Übersicht ersetzt nicht die vollständigen Lizenztexte."),
  "about.desktopFramework": message("Desktop application framework and frontend API", "桌面应用框架与前端接口", "桌面應用程式框架與前端介面", "デスクトップアプリケーションフレームワークとフロントエンド API", "Framework de escritorio y API de frontend", "Cadre d’application de bureau et API frontend", "Desktop-Anwendungsframework und Frontend-API"),
  "about.tauriApi": message("Tauri 2 and @tauri-apps/api", "Tauri 2 与 @tauri-apps/api", "Tauri 2 與 @tauri-apps/api", "Tauri 2 と @tauri-apps/api", "Tauri 2 y @tauri-apps/api", "Tauri 2 et @tauri-apps/api", "Tauri 2 und @tauri-apps/api"),
  "about.fileDialog": message("System file selection dialogs", "系统文件选择对话框", "系統檔案選擇對話框", "システムファイル選択ダイアログ", "Diálogos de selección de archivos del sistema", "Dialogues système de sélection de fichiers", "Systemdialoge zur Dateiauswahl"),
  "about.serialization": message("Rust data serialization", "Rust 数据序列化", "Rust 資料序列化", "Rust データシリアライズ", "Serialización de datos Rust", "Sérialisation des données Rust", "Rust-Datenserialisierung"),
  "about.serde": message("Serde and serde_json", "Serde 与 serde_json", "Serde 與 serde_json", "Serde と serde_json", "Serde y serde_json", "Serde et serde_json", "Serde und serde_json"),
  "about.memoryMap": message("RAW file memory mapping", "RAW 文件内存映射", "RAW 檔案記憶體映射", "RAW ファイルのメモリマッピング", "Mapeo de archivos RAW en memoria", "Mappage mémoire des fichiers RAW", "Speicherabbildung von RAW-Dateien"),
  "about.buildTool": message("Frontend build tool", "前端构建工具", "前端建置工具", "フロントエンドビルドツール", "Herramienta de compilación frontend", "Outil de build frontend", "Frontend-Build-Werkzeug"),
  "about.typeSystem": message("Frontend type system and compiler", "前端类型系统与编译工具", "前端型別系統與編譯工具", "フロントエンド型システムとコンパイラ", "Sistema de tipos y compilador frontend", "Système de types et compilateur frontend", "Frontend-Typsystem und Compiler"),
  "about.licenseNote": message("A complete transitive dependency license list will accompany the source and release artifacts before public release.", "完整传递依赖许可证清单将在正式公开发布前随源代码与发布产物提供。", "完整的傳遞相依性授權清單將於正式公開發布前隨原始碼與發布產物提供。", "完全な推移的依存関係のライセンス一覧は公開リリース前にソースと成果物へ同梱します。", "La lista completa de licencias de dependencias transitivas acompañará al código y los artefactos antes de la publicación.", "La liste complète des licences des dépendances transitives accompagnera le code source et les artefacts avant publication.", "Eine vollständige Lizenzliste transitiver Abhängigkeiten wird vor der Veröffentlichung Quellcode und Artefakten beigefügt."),
  "about.back": message("Back to About", "返回关于", "返回關於", "バージョン情報に戻る", "Volver a Acerca de", "Retour à À propos", "Zurück zu Info"),

  "export.eyebrow": message("DETERMINISTIC CONVERSION", "确定性转换", "決定性轉換", "決定論的変換", "CONVERSIÓN DETERMINISTA", "CONVERSION DÉTERMINISTE", "DETERMINISTISCHE KONVERTIERUNG"),
  "export.title": message("Export RAW data", "导出 RAW 数据", "匯出 RAW 資料", "RAW データをエクスポート", "Exportar datos RAW", "Exporter les données RAW", "RAW-Daten exportieren"),
  "export.snapshot": message("Source snapshot", "来源快照", "來源快照", "ソーススナップショット", "Instantánea de origen", "Instantané source", "Quell-Snapshot"),
  "export.range": message("Valid region", "有效区域", "有效區域", "有効領域", "Región válida", "Zone valide", "Gültiger Bereich"),
  "export.rangeMode": message("Range input mode", "范围输入方式", "範圍輸入方式", "範囲入力方法", "Modo de entrada del rango", "Mode de saisie de la zone", "Eingabemodus für Bereich"),
  "export.startSize": message("Start + size", "起点 + 宽高", "起點 + 寬高", "開始点 + サイズ", "Inicio + tamaño", "Début + dimensions", "Start + Größe"),
  "export.startEnd": message("Start + end coordinates", "起点 + 结束坐标", "起點 + 結束座標", "開始点 + 終了座標", "Inicio + coordenadas finales", "Début + coordonnées de fin", "Start + Endkoordinaten"),
  "export.startX": message("Start X", "起点 X", "起點 X", "開始 X", "Inicio X", "Début X", "Start X"),
  "export.startY": message("Start Y", "起点 Y", "起點 Y", "開始 Y", "Inicio Y", "Début Y", "Start Y"),
  "export.width": message("Width", "宽度", "寬度", "幅", "Anchura", "Largeur", "Breite"),
  "export.height": message("Height", "高度", "高度", "高さ", "Altura", "Hauteur", "Höhe"),
  "export.endX": message("End X (inclusive)", "结束 X（包含）", "結束 X（包含）", "終了 X（含む）", "Fin X (incluida)", "Fin X (incluse)", "Ende X (einschließlich)"),
  "export.endY": message("End Y (inclusive)", "结束 Y（包含）", "結束 Y（包含）", "終了 Y（含む）", "Fin Y (incluida)", "Fin Y (incluse)", "Ende Y (einschließlich)"),
  "export.outputCfa": message("Output CFA:", "输出 CFA：", "輸出 CFA：", "出力 CFA：", "CFA de salida:", "CFA de sortie :", "Ausgabe-CFA:"),
  "export.encoding": message("Output encoding", "输出编码", "輸出編碼", "出力エンコーディング", "Codificación de salida", "Encodage de sortie", "Ausgabecodierung"),
  "export.containerLow": message("Container low bits LSB", "容器低位 LSB", "容器低位 LSB", "コンテナ下位ビット LSB", "Bits bajos del contenedor LSB", "Bits faibles du conteneur LSB", "Niederwertige Container-Bits LSB"),
  "export.containerHigh": message("Container high bits MSB", "容器高位 MSB", "容器高位 MSB", "コンテナ上位ビット MSB", "Bits altos del contenedor MSB", "Bits forts du conteneur MSB", "Höherwertige Container-Bits MSB"),
  "export.valueMapping": message("Pixel value mapping", "像素值映射", "像素值映射", "画素値マッピング", "Mapeo de valores de píxel", "Conversion des valeurs de pixel", "Pixelwertabbildung"),
  "export.preserve": message("Preserve values; clip overflow", "保持数值，超限裁剪", "保留數值，超限裁剪", "値を保持し、超過分をクリップ", "Conservar valores y recortar exceso", "Conserver les valeurs et écrêter les dépassements", "Werte beibehalten, Überlauf beschneiden"),
  "export.scale": message("Scale to full range", "按满量程缩放", "依滿量程縮放", "フルレンジにスケーリング", "Escalar al rango completo", "Mettre à l’échelle sur toute la plage", "Auf vollen Bereich skalieren"),
  "export.missingFill": message("Missing-pixel fill", "缺失像素填充", "缺失像素填充", "欠損画素の補完", "Relleno de píxeles ausentes", "Remplissage des pixels manquants", "Füllwert für fehlende Pixel"),
  "export.fillHint": message("Fill values are final output DN and are not affected by preservation or full-range scaling.", "填充值属于最终输出 DN，不参与保持数值或满量程缩放。", "填充值屬於最終輸出 DN，不參與保留數值或滿量程縮放。", "補完値は最終出力 DN であり、値の保持やフルレンジ変換の対象外です。", "Los valores de relleno son DN finales y no se escalan.", "Les valeurs de remplissage sont des DN de sortie et ne sont pas mises à l’échelle.", "Füllwerte sind endgültige Ausgabe-DN und werden nicht skaliert."),
  "export.monoDn": message("MONO output DN", "MONO 输出 DN", "MONO 輸出 DN", "MONO 出力 DN", "DN de salida MONO", "DN de sortie MONO", "MONO-Ausgabe-DN"),
  "export.gb": message("Gb (green on blue row)", "Gb（蓝行绿）", "Gb（藍列綠）", "Gb（青行の緑）", "Gb (verde en fila azul)", "Gb (vert sur ligne bleue)", "Gb (Grün in blauer Zeile)"),
  "export.gr": message("Gr (green on red row)", "Gr（红行绿）", "Gr（紅列綠）", "Gr（赤行の緑）", "Gr (verde en fila roja)", "Gr (vert sur ligne rouge)", "Gr (Grün in roter Zeile)"),
  "export.currentOnly": message("Only the current frame in the source snapshot is exported.", "仅导出来源快照中的当前帧。", "僅匯出來源快照中的目前影格。", "ソーススナップショットの現在のフレームのみをエクスポートします。", "Solo se exporta el fotograma actual de la instantánea.", "Seule l’image actuelle de l’instantané est exportée.", "Nur der aktuelle Frame des Quell-Snapshots wird exportiert."),
  "export.choose": message("Choose location and export", "选择位置并导出", "選擇位置並匯出", "保存先を選択してエクスポート", "Elegir ubicación y exportar", "Choisir l’emplacement et exporter", "Speicherort wählen und exportieren"),
  "export.snapshotSummary": message("Frame {frame}/{count} · {width} × {height} · {depth} bit · {packing} · {cfa}", "帧 {frame}/{count} · {width} × {height} · {depth} bit · {packing} · {cfa}", "影格 {frame}/{count} · {width} × {height} · {depth} bit · {packing} · {cfa}", "フレーム {frame}/{count}・{width} × {height}・{depth} bit・{packing}・{cfa}", "Fotograma {frame}/{count} · {width} × {height} · {depth} bit · {packing} · {cfa}", "Image {frame}/{count} · {width} × {height} · {depth} bit · {packing} · {cfa}", "Frame {frame}/{count} · {width} × {height} · {depth} Bit · {packing} · {cfa}"),
  "export.exporting": message("Exporting…", "正在导出…", "正在匯出…", "エクスポート中…", "Exportando…", "Exportation…", "Exportieren…"),
  "export.integerCoordinate": message("Enter integer coordinates", "请输入整数坐标", "請輸入整數座標", "整数座標を入力してください", "Introduzca coordenadas enteras", "Saisissez des coordonnées entières", "Ganzzahlige Koordinaten eingeben"),
  "export.positiveInteger": message("Enter an integer greater than 0", "请输入大于 0 的整数", "請輸入大於 0 的整數", "0 より大きい整数を入力してください", "Introduzca un entero mayor que 0", "Saisissez un entier supérieur à 0", "Ganzzahl größer als 0 eingeben"),
  "export.rangeIncomplete": message("Range is incomplete", "范围尚未完成", "範圍尚未完成", "範囲が未完成です", "El rango está incompleto", "La zone est incomplète", "Bereich ist unvollständig"),
  "export.rgb48Fixed": message("Fixed RGB48 Interleaved · R16 G16 B16 · DN preserves {depth}-bit range", "固定 RGB48 Interleaved · R16 G16 B16 · DN 保持 {depth} bit 范围", "固定 RGB48 Interleaved · R16 G16 B16 · DN 保留 {depth} bit 範圍", "固定 RGB48 Interleaved・R16 G16 B16・DN は {depth} bit 範囲を保持", "RGB48 Interleaved fijo · R16 G16 B16 · DN conserva rango de {depth} bits", "RGB48 Interleaved fixe · R16 G16 B16 · DN conserve la plage {depth} bits", "Festes RGB48 Interleaved · R16 G16 B16 · DN behält {depth}-Bit-Bereich"),
  "export.standardBayer": message("Output standard Bayer · {method}", "输出标准 Bayer · {method}", "輸出標準 Bayer · {method}", "標準 Bayer を出力・{method}", "Generar Bayer estándar · {method}", "Produire un Bayer standard · {method}", "Standard-Bayer ausgeben · {method}"),
  "export.originalOnly": message("Convert original CFA data without image processing", "转换原始 CFA 数据，不执行图像处理", "轉換原始 CFA 資料，不執行影像處理", "画像処理せず元の CFA データを変換", "Convertir datos CFA originales sin procesar la imagen", "Convertir les données CFA d’origine sans traitement d’image", "Original-CFA-Daten ohne Bildverarbeitung konvertieren"),
  "export.formatMono": message("Output format: MONO", "输出格式：MONO", "輸出格式：MONO", "出力形式：MONO", "Formato de salida: MONO", "Format de sortie : MONO", "Ausgabeformat: MONO"),
  "export.rgbFill": message("Missing RGB pixels use R, (Gr+Gb)/2 and B", "缺失 RGB 像素使用 R、(Gr+Gb)/2、B", "缺失 RGB 像素使用 R、(Gr+Gb)/2、B", "欠損 RGB 画素には R、(Gr+Gb)/2、B を使用", "Los píxeles RGB ausentes usan R, (Gr+Gb)/2 y B", "Les pixels RGB manquants utilisent R, (Gr+Gb)/2 et B", "Fehlende RGB-Pixel verwenden R, (Gr+Gb)/2 und B"),
  "export.cfaFill": message("Fill each output CFA site separately", "按输出 CFA 站点分别填充", "依輸出 CFA 站點分別填充", "出力 CFA サイトごとに補完", "Rellenar cada sitio CFA de salida por separado", "Remplir séparément chaque site CFA de sortie", "Jede Ausgabe-CFA-Position separat füllen"),
  "export.integer": message("Enter an integer", "请输入整数", "請輸入整數", "整数を入力してください", "Introduzca un entero", "Saisissez un entier", "Ganzzahl eingeben"),
  "export.safePositive": message("Must be a positive safe integer", "必须是大于 0 的安全整数", "必須是大於 0 的安全整數", "正の安全な整数である必要があります", "Debe ser un entero seguro positivo", "Doit être un entier positif sûr", "Muss eine positive sichere Ganzzahl sein"),
  "export.integerRange": message("Enter an integer from 0 to {max}", "请输入 0–{max} 之间的整数", "請輸入 0–{max} 之間的整數", "0～{max} の整数を入力してください", "Introduzca un entero entre 0 y {max}", "Saisissez un entier entre 0 et {max}", "Ganzzahl zwischen 0 und {max} eingeben"),
  "export.fixFields": message("Correct the highlighted export parameters and try again.", "请修正标红的导出参数后重试。", "請修正標紅的匯出參數後重試。", "強調表示されたエクスポートパラメーターを修正してください。", "Corrija los parámetros resaltados e inténtelo de nuevo.", "Corrigez les paramètres en surbrillance et réessayez.", "Markierte Exportparameter korrigieren und erneut versuchen."),
  "export.writing": message("Converting and safely writing RAW data…", "正在转换并安全写入 RAW 数据…", "正在轉換並安全寫入 RAW 資料…", "RAW データを変換して安全に書き込み中…", "Convirtiendo y escribiendo datos RAW de forma segura…", "Conversion et écriture sécurisée des données RAW…", "RAW-Daten werden konvertiert und sicher geschrieben…"),
  "export.clipped": message("clipped {count} pixels", "裁剪 {count} 像素", "裁剪 {count} 像素", "{count} 画素をクリップ", "{count} píxeles recortados", "{count} pixels écrêtés", "{count} Pixel beschnitten"),
  "export.filled": message("filled {count} pixels", "填充 {count} 像素", "填充 {count} 像素", "{count} 画素を補完", "{count} píxeles rellenados", "{count} pixels remplis", "{count} Pixel gefüllt"),
  "export.success": message("Exported current frame · {bytes} · {format}{missing}{clipped}", "已导出当前帧 · {bytes} · {format}{missing}{clipped}", "已匯出目前影格 · {bytes} · {format}{missing}{clipped}", "現在のフレームをエクスポートしました・{bytes}・{format}{missing}{clipped}", "Fotograma actual exportado · {bytes} · {format}{missing}{clipped}", "Image actuelle exportée · {bytes} · {format}{missing}{clipped}", "Aktuellen Frame exportiert · {bytes} · {format}{missing}{clipped}"),
  "export.rgb48Format": message("RGB48 Interleaved · {depth} bit effective DN", "RGB48 Interleaved · {depth} bit 有效 DN", "RGB48 Interleaved · {depth} bit 有效 DN", "RGB48 Interleaved・{depth} bit 有効 DN", "RGB48 Interleaved · DN efectivo de {depth} bits", "RGB48 Interleaved · DN utile {depth} bits", "RGB48 Interleaved · {depth} Bit effektiver DN"),
  "export.failed": message("Export failed", "导出失败", "匯出失敗", "エクスポートに失敗しました", "Error de exportación", "Échec de l’exportation", "Export fehlgeschlagen"),
  "export.partialFrame": message("The source frame is incomplete; unreadable pixels will use the per-channel output DN values below.", "当前来源帧不完整；读取不到的像素将使用下方按通道设置的输出 DN。", "目前來源影格不完整；無法讀取的像素將使用下方各通道輸出 DN。", "ソースフレームが不完全です。読み取れない画素には下記のチャンネル別出力 DN を使用します。", "El fotograma de origen está incompleto; los píxeles ilegibles usarán los DN por canal.", "L’image source est incomplète ; les pixels illisibles utiliseront les DN de sortie par canal.", "Quell-Frame ist unvollständig; nicht lesbare Pixel verwenden die kanalweisen Ausgabe-DN."),
  "export.summaryPending": message("Complete the parameters to show the estimated output size.", "完成参数后显示预计输出大小。", "完成參數後顯示預估輸出大小。", "パラメーターを完了すると推定出力サイズを表示します。", "Complete los parámetros para ver el tamaño estimado.", "Complétez les paramètres pour afficher la taille estimée.", "Parameter vervollständigen, um die geschätzte Ausgabegröße anzuzeigen."),
  "export.sizeEstimate": message("Current frame only · row stride {row} · estimated {bytes}", "仅导出当前帧 · 行步长 {row} · 预计 {bytes}", "僅匯出目前影格 · 列步幅 {row} · 預估 {bytes}", "現在のフレームのみ・行ストライド {row}・推定 {bytes}", "Solo fotograma actual · stride de fila {row} · estimado {bytes}", "Image actuelle uniquement · pas de ligne {row} · estimation {bytes}", "Nur aktueller Frame · Zeilen-Stride {row} · geschätzt {bytes}"),
  "export.sizeOverflow": message("Output size exceeds the safe calculation range; reduce dimensions or alignment.", "输出大小超过安全计算范围，请减小尺寸或对齐值。", "輸出大小超過安全計算範圍，請縮小尺寸或對齊值。", "出力サイズが安全な計算範囲を超えています。サイズまたはアラインメントを減らしてください。", "El tamaño supera el rango seguro; reduzca dimensiones o alineación.", "La taille dépasse la plage de calcul sûre ; réduisez les dimensions ou l’alignement.", "Ausgabegröße überschreitet den sicheren Bereich; Abmessungen oder Ausrichtung reduzieren."),
  "export.titleRemosaic": message("Export Remosaic Bayer", "导出 Remosaic Bayer", "匯出 Remosaic Bayer", "Remosaic Bayer をエクスポート", "Exportar Remosaic Bayer", "Exporter Remosaic Bayer", "Remosaic Bayer exportieren"),
  "export.titleDemosaic": message("Export Demosaic RGB", "导出 Demosaic RGB", "匯出 Demosaic RGB", "Demosaic RGB をエクスポート", "Exportar Demosaic RGB", "Exporter Demosaic RGB", "Demosaic RGB exportieren"),
  "export.titleOriginal": message("Export original CFA", "导出原始 CFA", "匯出原始 CFA", "元の CFA をエクスポート", "Exportar CFA original", "Exporter le CFA d’origine", "Original-CFA exportieren"),
  "export.sameColor": message("Same-color bilinear reconstruction", "同色双线性重建", "同色雙線性重建", "同色バイリニア再構成", "Reconstrucción bilineal del mismo color", "Reconstruction bilinéaire de même couleur", "Bilineare Rekonstruktion gleicher Farben"),
  "export.reorder": message("4×4 block reordering only", "仅 4×4 块内重排", "僅 4×4 區塊內重排", "4×4 ブロック内の並べ替えのみ", "Solo reordenar bloques 4×4", "Réorganisation des blocs 4×4 uniquement", "Nur Neuordnung innerhalb von 4×4-Blöcken"),

  "runtime.opening": message("Mapping and analyzing RAW file…", "正在映射并分析 RAW 文件…", "正在映射並分析 RAW 檔案…", "RAW ファイルをマッピングして解析中…", "Mapeando y analizando el archivo RAW…", "Mappage et analyse du fichier RAW…", "RAW-Datei wird abgebildet und analysiert…"),
  "runtime.opened": message("Opened {name}", "已打开 {name}", "已開啟 {name}", "{name} を開きました", "Se abrió {name}", "{name} ouvert", "{name} geöffnet"),
  "runtime.closing": message("Releasing {name}…", "正在释放 {name}…", "正在釋放 {name}…", "{name} を解放しています…", "Liberando {name}…", "Libération de {name}…", "{name} wird freigegeben…"),
  "runtime.closed": message("Closed {name}", "已关闭 {name}", "已關閉 {name}", "{name} を閉じました", "Se cerró {name}", "{name} fermé", "{name} geschlossen"),
  "runtime.closeBlockedByExport": message("Finish or close the export dialog before closing the RAW file.", "请先完成或关闭导出窗口，再关闭 RAW 文件。", "請先完成或關閉匯出視窗，再關閉 RAW 檔案。", "RAW ファイルを閉じる前に、エクスポート画面を完了または閉じてください。", "Finalice o cierre el diálogo de exportación antes de cerrar el archivo RAW.", "Terminez ou fermez la fenêtre d’exportation avant de fermer le fichier RAW.", "Schließen oder beenden Sie den Exportdialog, bevor Sie die RAW-Datei schließen."),
  "runtime.invalidZoom": message("Enter a valid zoom value", "请输入有效的缩放值", "請輸入有效的縮放值", "有効なズーム値を入力してください", "Introduzca un valor de zoom válido", "Saisissez une valeur de zoom valide", "Gültigen Zoomwert eingeben"),
  "runtime.adjustMin": message("Adjusted to the minimum", "已调整至下限", "已調整至下限", "最小値に調整しました", "Ajustado al mínimo", "Ajusté au minimum", "Auf das Minimum angepasst"),
  "runtime.adjustMax": message("Adjusted to the maximum", "已调整至上限", "已調整至上限", "最大値に調整しました", "Ajustado al máximo", "Ajusté au maximum", "Auf das Maximum angepasst"),
  "runtime.rounded": message("Rounded to two decimal places", "已保留两位小数", "已保留兩位小數", "小数第 2 位に丸めました", "Redondeado a dos decimales", "Arrondi à deux décimales", "Auf zwei Dezimalstellen gerundet"),
  "runtime.effectiveZoom": message("Effective value: {value}% ({adjustment})", "实际应用：{value}%（{adjustment}）", "實際套用：{value}%（{adjustment}）", "適用値：{value}%（{adjustment}）", "Valor aplicado: {value}% ({adjustment})", "Valeur appliquée : {value}% ({adjustment})", "Angewendeter Wert: {value}% ({adjustment})"),
  "runtime.zoomRange": message("Available range: {min}%–{max}%", "可设置范围：{min}%–{max}%", "可設定範圍：{min}%–{max}%", "設定可能範囲：{min}%～{max}%", "Rango disponible: {min}%–{max}%", "Plage disponible : {min}%–{max}%", "Verfügbarer Bereich: {min}%–{max}%"),
  "runtime.coordinateRange": message("Valid range: X 0–{x} · Y 0–{y}", "有效范围：X 0–{x} · Y 0–{y}", "有效範圍：X 0–{x} · Y 0–{y}", "有効範囲：X 0～{x}・Y 0～{y}", "Rango válido: X 0–{x} · Y 0–{y}", "Plage valide : X 0–{x} · Y 0–{y}", "Gültiger Bereich: X 0–{x} · Y 0–{y}"),
  "runtime.coordinateError": message("{axis} must be an integer from 0 to {max}", "{axis} 坐标必须是 0–{max} 之间的整数", "{axis} 座標必須是 0–{max} 之間的整數", "{axis} 座標は 0～{max} の整数である必要があります", "La coordenada {axis} debe ser un entero entre 0 y {max}", "La coordonnée {axis} doit être un entier entre 0 et {max}", "Die {axis}-Koordinate muss eine Ganzzahl zwischen 0 und {max} sein"),
  "runtime.fullscreenFailed": message("Could not switch native fullscreen mode.\n{detail}", "无法切换原生全屏模式。\n{detail}", "無法切換原生全螢幕模式。\n{detail}", "ネイティブ全画面モードに切り替えられませんでした。\n{detail}", "No se pudo cambiar al modo de pantalla completa nativo.\n{detail}", "Impossible de basculer en plein écran natif.\n{detail}", "Der native Vollbildmodus konnte nicht umgeschaltet werden.\n{detail}"),
  "runtime.renderFailed": message("Some tiles failed to render. Automatic retries have stopped; change parameters, frame or display mode to retry.\n{detail}", "部分瓦片渲染失败，已停止自动重试；修改参数、帧或显示模式后可重新尝试。\n{detail}", "部分圖塊渲染失敗，已停止自動重試；變更參數、影格或顯示模式後可重試。\n{detail}", "一部のタイルの描画に失敗しました。自動再試行を停止しました。パラメーター、フレーム、表示モードを変更して再試行してください。\n{detail}", "No se pudieron renderizar algunos mosaicos. Se detuvieron los reintentos automáticos; cambie los parámetros, el fotograma o el modo para reintentar.\n{detail}", "Le rendu de certaines tuiles a échoué. Les tentatives automatiques sont arrêtées ; modifiez les paramètres, l’image ou le mode pour réessayer.\n{detail}", "Einige Kacheln konnten nicht gerendert werden. Automatische Wiederholungen wurden beendet; Parameter, Frame oder Anzeigemodus ändern, um erneut zu versuchen.\n{detail}"),
  "runtime.pixelReadFailed": message("High-zoom pixel values could not be read. Automatic retries have stopped; change parameters, frame or display mode to retry.\n{detail}", "高倍率像素值读取失败，已停止自动重试；修改参数、帧或显示模式后可重新尝试。\n{detail}", "高倍率像素值讀取失敗，已停止自動重試；變更參數、影格或顯示模式後可重試。\n{detail}", "高倍率の画素値を読み取れませんでした。自動再試行を停止しました。パラメーター、フレーム、表示モードを変更して再試行してください。\n{detail}", "No se pudieron leer los valores de píxel con zoom alto. Se detuvieron los reintentos automáticos; cambie los parámetros, el fotograma o el modo.\n{detail}", "Impossible de lire les valeurs de pixel à fort zoom. Les tentatives automatiques sont arrêtées ; modifiez les paramètres, l’image ou le mode.\n{detail}", "Pixelwerte bei starker Vergrößerung konnten nicht gelesen werden. Automatische Wiederholungen wurden beendet; Parameter, Frame oder Anzeigemodus ändern.\n{detail}"),
  "runtime.fatalTitle": message("eRAW could not start", "eRAW 无法启动", "eRAW 無法啟動", "eRAW を起動できません", "No se pudo iniciar eRAW", "Impossible de démarrer eRAW", "eRAW konnte nicht gestartet werden"),
  "runtime.fatalHint": message("Confirm that WebView2 and the graphics driver support WebGL2.", "请确认 WebView2 和显卡驱动支持 WebGL2。", "請確認 WebView2 與顯示卡驅動程式支援 WebGL2。", "WebView2 とグラフィックスドライバーが WebGL2 に対応していることを確認してください。", "Confirme que WebView2 y el controlador gráfico son compatibles con WebGL2.", "Vérifiez que WebView2 et le pilote graphique prennent en charge WebGL2.", "Prüfen Sie, ob WebView2 und der Grafiktreiber WebGL2 unterstützen."),
  "runtime.remosaicReconstructTitle": message("View the standard Bayer mosaic after same-color bilinear reconstruction", "查看同色双线性重建后的标准 Bayer 点阵", "檢視同色雙線性重建後的標準 Bayer 點陣", "同色バイリニア再構成後の標準 Bayer モザイクを表示", "Ver el mosaico Bayer estándar tras la reconstrucción bilineal del mismo color", "Afficher la mosaïque Bayer standard après reconstruction bilinéaire de même couleur", "Standard-Bayer-Mosaik nach bilinearer Rekonstruktion gleicher Farben anzeigen"),
  "runtime.demosaicHelp": message("Color CFA Demosaic currently uses bilinear interpolation; more algorithms can be added here later.", "当前彩色 CFA 的 Demosaic 使用双线性插值；后续算法将在此扩展。", "目前彩色 CFA 的 Demosaic 使用雙線性插值；後續演算法將於此擴充。", "カラー CFA の Demosaic は現在バイリニア補間を使用し、今後ここにアルゴリズムを追加できます。", "Demosaic usa actualmente interpolación bilineal; aquí podrán añadirse más algoritmos.", "Demosaic utilise actuellement une interpolation bilinéaire ; d’autres algorithmes pourront être ajoutés ici.", "Demosaic verwendet derzeit bilineare Interpolation; weitere Algorithmen können später ergänzt werden."),
  "runtime.sameColorHelp": message("Reconstruct DN from same-color QCFA samples at target Bayer sites. This costs more CPU than reordering and may increase tile time for very large images or frequent zooming.", "按目标 Bayer 站点从相同颜色的 QCFA 样本进行双线性重建。相比仅重排需要更多 CPU 计算，超大图像或频繁缩放时，瓦片完成时间可能明显增加。", "依目標 Bayer 站點從同色 QCFA 樣本進行雙線性重建。較僅重排需要更多 CPU，超大影像或頻繁縮放時圖塊完成時間可能增加。", "対象 Bayer サイトで同色 QCFA サンプルから DN を再構成します。並べ替えのみより CPU 負荷が高く、巨大画像や頻繁なズームではタイル時間が増える場合があります。", "Reconstruye DN desde muestras QCFA del mismo color. Consume más CPU que reordenar y puede aumentar el tiempo de mosaicos.", "Reconstruit le DN à partir d’échantillons QCFA de même couleur. Plus coûteux en CPU que la réorganisation, cela peut ralentir les tuiles.", "Rekonstruiert DN aus gleichfarbigen QCFA-Abtastungen. Benötigt mehr CPU als Neuordnung und kann die Kachelzeit erhöhen."),
  "runtime.remosaicReorderTitle": message("View the standard Bayer mosaic after 4×4 block reordering", "查看 4×4 块内重排后的标准 Bayer 点阵", "檢視 4×4 區塊內重排後的標準 Bayer 點陣", "4×4 ブロック内並べ替え後の標準 Bayer モザイクを表示", "Ver el mosaico Bayer estándar tras reordenar bloques de 4×4", "Afficher la mosaïque Bayer standard après réorganisation des blocs 4×4", "Standard-Bayer-Mosaik nach Neuordnung innerhalb von 4×4-Blöcken anzeigen"),
  "runtime.quadDemosaicTitle": message("Apply current Remosaic settings, then bilinear Demosaic", "先应用当前 Remosaic 设置，再执行双线性 Demosaic", "先套用目前 Remosaic 設定，再執行雙線性 Demosaic", "現在の Remosaic 設定を適用してからバイリニア Demosaic を実行", "Aplicar los ajustes actuales de Remosaic y después Demosaic bilineal", "Appliquer les réglages Remosaic actuels puis un Demosaic bilinéaire", "Aktuelle Remosaic-Einstellungen anwenden, dann bilineares Demosaic ausführen"),
  "runtime.bayerDemosaicTitle": message("Apply bilinear Demosaic to standard Bayer", "对标准 Bayer 执行双线性 Demosaic", "對標準 Bayer 執行雙線性 Demosaic", "標準 Bayer にバイリニア Demosaic を適用", "Aplicar Demosaic bilineal a Bayer estándar", "Appliquer un Demosaic bilinéaire au Bayer standard", "Bilineares Demosaic auf Standard-Bayer anwenden"),
  "runtime.monoDemosaicTitle": message("Demosaic is not used for Mono images", "Mono 图像不使用 Demosaic", "Mono 影像不使用 Demosaic", "Mono 画像では Demosaic を使用しません", "Las imágenes Mono no usan Demosaic", "Les images Mono n’utilisent pas Demosaic", "Mono-Bilder verwenden kein Demosaic"),
  "runtime.tileTiming": message("Current view completed {samples} tile(s); latest {last}, average {average}, slowest {max}.", "当前视图已完成 {samples} 个瓦片；最近 {last}，平均 {average}，最慢 {max}。", "目前視圖已完成 {samples} 個圖塊；最近 {last}，平均 {average}，最慢 {max}。", "現在のビューで {samples} タイル完了；直近 {last}、平均 {average}、最長 {max}。", "Vista actual: {samples} mosaico(s); último {last}, media {average}, máximo {max}.", "Vue actuelle : {samples} tuile(s) ; dernière {last}, moyenne {average}, plus lente {max}.", "Aktuelle Ansicht: {samples} Kachel(n); zuletzt {last}, Durchschnitt {average}, langsamste {max}."),
  "runtime.noTileTiming": message("No tiles have completed in the current view.", "当前视图尚无已完成瓦片。", "目前視圖尚無已完成圖塊。", "現在のビューではまだタイルが完了していません。", "Aún no se ha completado ningún mosaico en la vista actual.", "Aucune tuile n’est encore terminée dans la vue actuelle.", "In der aktuellen Ansicht sind noch keine Kacheln abgeschlossen."),
  "runtime.renderHelp": message("L is the current preview level; Lx↔Ly means adjacent levels are blending. tiles is the number loaded in the current view; loading is the number still decoding, transferring or uploading textures. {timing}", "L 表示当前预览层级；Lx↔Ly 表示正在混合相邻层级。tiles 是当前视野中已完成的瓦片数；loading 是当前视野仍在解码、传输或上传纹理的请求数。{timing}", "L 表示目前預覽層級；Lx↔Ly 表示正在混合相鄰層級。tiles 是目前視野中已完成的圖塊數；loading 是仍在解碼、傳輸或上傳紋理的請求數。{timing}", "L は現在のプレビュー階層、Lx↔Ly は隣接階層の混合を示します。tiles は読み込み済み、loading はデコード、転送、テクスチャアップロード中の数です。{timing}", "L es el nivel actual; Lx↔Ly indica mezcla de niveles. tiles son los mosaicos cargados y loading los que aún se decodifican, transfieren o suben. {timing}", "L est le niveau actuel ; Lx↔Ly indique le mélange de niveaux. tiles est le nombre chargé et loading le nombre encore en décodage, transfert ou téléversement. {timing}", "L ist die aktuelle Ebene; Lx↔Ly kennzeichnet die Mischung benachbarter Ebenen. tiles sind geladene Kacheln, loading noch zu dekodierende, zu übertragende oder hochzuladende. {timing}"),
  "runtime.renderInitialHelp": message("L is the current preview level; Lx↔Ly means adjacent levels are blending. tiles is the number loaded in the current view; loading is the number still decoding, transferring or uploading textures. 0 means complete or cached.", "L 表示当前预览层级；Lx↔Ly 表示正在平滑混合相邻层级。tiles 是当前视野中已完成的瓦片数；loading 是正在解码、传输或上传纹理的请求数，0 表示已完成或命中缓存。", "L 表示目前預覽層級；Lx↔Ly 表示正在平滑混合相鄰層級。tiles 是目前視野中已完成的圖塊數；loading 是正在解碼、傳輸或上傳紋理的請求數，0 表示已完成或命中快取。", "L は現在のプレビュー階層、Lx↔Ly は隣接階層の混合を示します。tiles は読み込み済み、loading は処理中の数で、0 は完了またはキャッシュ済みです。", "L es el nivel actual; Lx↔Ly indica mezcla de niveles. tiles son los mosaicos cargados y loading los que siguen en proceso; 0 indica completo o en caché.", "L est le niveau actuel ; Lx↔Ly indique le mélange des niveaux. tiles est le nombre chargé et loading le nombre en cours ; 0 signifie terminé ou en cache.", "L ist die aktuelle Ebene; Lx↔Ly kennzeichnet die Ebenenmischung. tiles sind geladene Kacheln, loading die noch verarbeiteten; 0 bedeutet abgeschlossen oder im Cache."),
  "error.rootMissing": message("Could not create the eRAW application root", "无法建立 eRAW 应用根节点", "無法建立 eRAW 應用程式根節點", "eRAW アプリケーションのルートを作成できません", "No se pudo crear la raíz de la aplicación eRAW", "Impossible de créer la racine de l’application eRAW", "eRAW-Anwendungsstamm konnte nicht erstellt werden"),
  "error.elementMissing": message("Missing interface element #{id}", "缺少界面元素 #{id}", "缺少介面元素 #{id}", "インターフェース要素 #{id} がありません", "Falta el elemento de interfaz #{id}", "Élément d’interface manquant : #{id}", "Oberflächenelement #{id} fehlt"),
  "error.shaderCreate": message("Could not create WebGL shader", "无法创建 WebGL 着色器", "無法建立 WebGL 著色器", "WebGL シェーダーを作成できません", "No se pudo crear el shader WebGL", "Impossible de créer le shader WebGL", "WebGL-Shader konnte nicht erstellt werden"),
  "error.shaderCompile": message("WebGL shader compilation failed: {detail}", "WebGL 着色器编译失败：{detail}", "WebGL 著色器編譯失敗：{detail}", "WebGL シェーダーのコンパイルに失敗しました：{detail}", "Falló la compilación del shader WebGL: {detail}", "Échec de la compilation du shader WebGL : {detail}", "Kompilierung des WebGL-Shaders fehlgeschlagen: {detail}"),
  "error.programCreate": message("Could not create WebGL program", "无法创建 WebGL 程序", "無法建立 WebGL 程式", "WebGL プログラムを作成できません", "No se pudo crear el programa WebGL", "Impossible de créer le programme WebGL", "WebGL-Programm konnte nicht erstellt werden"),
  "error.programLink": message("WebGL program linking failed: {detail}", "WebGL 程序链接失败：{detail}", "WebGL 程式連結失敗：{detail}", "WebGL プログラムのリンクに失敗しました：{detail}", "Falló el enlace del programa WebGL: {detail}", "Échec de l’édition de liens du programme WebGL : {detail}", "Verknüpfung des WebGL-Programms fehlgeschlagen: {detail}"),
  "error.webglUnsupported": message("This WebView2 does not support the WebGL2 canvas required by eRAW", "当前 WebView2 不支持 eRAW 所需的 WebGL2 画布", "目前 WebView2 不支援 eRAW 所需的 WebGL2 畫布", "現在の WebView2 は eRAW に必要な WebGL2 キャンバスに対応していません", "Este WebView2 no admite el lienzo WebGL2 requerido por eRAW", "Ce WebView2 ne prend pas en charge le canevas WebGL2 requis par eRAW", "Dieses WebView2 unterstützt die von eRAW benötigte WebGL2-Arbeitsfläche nicht"),
  "error.uniformUnavailable": message("WebGL uniform {name} is unavailable", "WebGL uniform {name} 不可用", "WebGL uniform {name} 無法使用", "WebGL uniform {name} は使用できません", "El uniform WebGL {name} no está disponible", "L’uniforme WebGL {name} n’est pas disponible", "WebGL-Uniform {name} ist nicht verfügbar"),
  "error.textureAllocation": message("GPU texture allocation failed", "GPU 纹理分配失败", "GPU 紋理配置失敗", "GPU テクスチャの割り当てに失敗しました", "Falló la asignación de textura GPU", "Échec de l’allocation de texture GPU", "GPU-Texturzuweisung fehlgeschlagen"),
  "error.selectionOverlayMissing": message("Image selection overlay is missing", "缺少图像选区叠加层", "缺少影像選取範圍疊加層", "画像選択オーバーレイがありません", "Falta la superposición de selección de imagen", "La superposition de sélection d’image est manquante", "Bildauswahl-Overlay fehlt"),
  "error.pixelCanvas": message("Could not create the pixel-value overlay canvas", "无法创建像素值叠加画布", "無法建立像素值疊加畫布", "画素値オーバーレイキャンバスを作成できません", "No se pudo crear el lienzo de valores de píxel", "Impossible de créer le canevas des valeurs de pixel", "Pixelwert-Overlay konnte nicht erstellt werden"),
  "error.pixelDataLength": message("Unexpected pixel inspection data length: expected {expected} B, received {actual} B", "像素检查数据长度异常：预期 {expected} B，实际 {actual} B", "像素檢查資料長度異常：預期 {expected} B，實際 {actual} B", "画素検査データの長さが不正です：予想 {expected} B、実際 {actual} B", "Longitud inesperada de datos de píxel: se esperaban {expected} B y se recibieron {actual} B", "Longueur inattendue des données de pixel : {expected} o attendus, {actual} o reçus", "Unerwartete Länge der Pixelprüfdaten: {expected} B erwartet, {actual} B empfangen"),
  "backend.documentNotOpen": message("No RAW file is open", "尚未打开 RAW 文件", "尚未開啟 RAW 檔案", "RAW ファイルが開かれていません", "No hay ningún archivo RAW abierto", "Aucun fichier RAW n’est ouvert", "Keine RAW-Datei geöffnet"),
  "backend.previewCachePoisoned": message("The preview cache is unavailable; restart the application", "预览缓存已损坏，请重新启动应用", "預覽快取無法使用，請重新啟動應用程式", "プレビューキャッシュを使用できません。アプリケーションを再起動してください", "La caché de vista previa no está disponible; reinicie la aplicación", "Le cache d’aperçu est indisponible ; redémarrez l’application", "Vorschaucache ist nicht verfügbar; Anwendung neu starten"),
  "backend.documentSessionPoisoned": message("The RAW document session is unavailable; restart the application", "RAW 文档会话已损坏，请重新启动应用", "RAW 文件工作階段無法使用，請重新啟動應用程式", "RAW ドキュメントセッションを使用できません。アプリケーションを再起動してください", "La sesión del documento RAW no está disponible; reinicie la aplicación", "La session du document RAW est indisponible ; redémarrez l’application", "RAW-Dokumentsitzung ist nicht verfügbar; Anwendung neu starten"),
  "backend.fileOpenFailed": message("Could not open the RAW file", "无法打开 RAW 文件", "無法開啟 RAW 檔案", "RAW ファイルを開けません", "No se pudo abrir el archivo RAW", "Impossible d’ouvrir le fichier RAW", "RAW-Datei konnte nicht geöffnet werden"),
  "backend.fileMetadataFailed": message("Could not read file information", "无法读取文件信息", "無法讀取檔案資訊", "ファイル情報を読み取れません", "No se pudo leer la información del archivo", "Impossible de lire les informations du fichier", "Dateiinformationen konnten nicht gelesen werden"),
  "backend.fileMapFailed": message("Could not memory-map the RAW file", "无法映射 RAW 文件", "無法映射 RAW 檔案", "RAW ファイルをメモリマップできません", "No se pudo mapear el archivo RAW en memoria", "Impossible de mapper le fichier RAW en mémoire", "RAW-Datei konnte nicht in den Speicher abgebildet werden"),
  "backend.tileTaskFailed": message("The tile rendering task failed", "瓦片渲染任务异常", "圖塊渲染工作失敗", "タイル描画タスクに失敗しました", "Falló la tarea de renderizado de mosaicos", "La tâche de rendu des tuiles a échoué", "Kachel-Rendering-Aufgabe fehlgeschlagen"),
  "backend.pixelTaskFailed": message("The pixel inspection task failed", "像素检查任务异常", "像素檢查工作失敗", "画素検査タスクに失敗しました", "Falló la tarea de inspección de píxeles", "La tâche d’inspection des pixels a échoué", "Pixelprüfungsaufgabe fehlgeschlagen"),
  "backend.exportTaskFailed": message("The RAW export task failed", "RAW 导出任务异常", "RAW 匯出工作失敗", "RAW エクスポートタスクに失敗しました", "Falló la tarea de exportación RAW", "La tâche d’exportation RAW a échoué", "RAW-Exportaufgabe fehlgeschlagen"),
  "backend.operationFailed": message("The operation could not be completed", "操作无法完成", "操作無法完成", "操作を完了できません", "No se pudo completar la operación", "L’opération n’a pas pu être effectuée", "Vorgang konnte nicht abgeschlossen werden"),
  "backend.exportSnapshotStale": message("The export source snapshot is stale; close and reopen the export dialog", "导出来源快照已失效，请关闭导出窗口后重新打开", "匯出來源快照已失效，請關閉並重新開啟匯出對話框", "エクスポート元のスナップショットが古くなりました。ダイアログを開き直してください", "La instantánea de origen ha caducado; cierre y vuelva a abrir el diálogo", "L’instantané source a expiré ; fermez puis rouvrez la boîte de dialogue", "Export-Quell-Snapshot ist veraltet; Dialog schließen und erneut öffnen"),
  "backend.exportOverwritesSource": message("The export path cannot overwrite the currently open source RAW file", "导出路径不能覆盖当前打开的源 RAW 文件", "匯出路徑不可覆寫目前開啟的來源 RAW 檔案", "エクスポート先に現在開いている RAW ファイルを上書きできません", "La ruta de exportación no puede sobrescribir el RAW de origen abierto", "Le chemin d’exportation ne peut pas écraser le RAW source ouvert", "Exportpfad darf die aktuell geöffnete RAW-Quelldatei nicht überschreiben"),
  "backend.exportInvalidCrop": message("Crop width and height must be greater than 0", "裁剪宽度和高度必须大于 0", "裁切寬度與高度必須大於 0", "クロップの幅と高さは 0 より大きい必要があります", "La anchura y altura del recorte deben ser mayores que 0", "La largeur et la hauteur du recadrage doivent être supérieures à 0", "Zuschnittbreite und -höhe müssen größer als 0 sein"),
  "backend.exportCropOutside": message("The crop region is outside the valid image", "裁剪区域超出有效图像范围", "裁切區域超出有效影像範圍", "クロップ範囲が有効画像を超えています", "La región de recorte queda fuera de la imagen válida", "La zone de recadrage dépasse l’image valide", "Zuschnittbereich liegt außerhalb des gültigen Bildes"),
  "backend.exportInvalidDepth": message("Output bit depth must be from 8 to 16 bits", "输出位深必须在 8 到 16 bit 之间", "輸出位元深度必須介於 8 至 16 bit", "出力ビット深度は 8～16 bit である必要があります", "La profundidad de salida debe estar entre 8 y 16 bits", "La profondeur de sortie doit être comprise entre 8 et 16 bits", "Ausgabebittiefe muss zwischen 8 und 16 Bit liegen"),
  "backend.exportPackingDepth": message("The selected packed output requires its matching fixed bit depth", "所选打包输出要求匹配的固定位深", "所選打包輸出需要相符的固定位元深度", "選択した packed 出力には対応する固定ビット深度が必要です", "La salida packed seleccionada requiere su profundidad fija correspondiente", "La sortie packed sélectionnée exige la profondeur fixe correspondante", "Gewählte packed-Ausgabe erfordert die passende feste Bittiefe"),
  "backend.exportQuadRequired": message("Only a Quad CFA source can export Remosaic Bayer", "只有 Quad CFA 来源可以导出 Remosaic Bayer", "僅 Quad CFA 來源可匯出 Remosaic Bayer", "Remosaic Bayer を出力できるのは Quad CFA ソースのみです", "Solo una fuente Quad CFA puede exportar Remosaic Bayer", "Seule une source Quad CFA peut exporter Remosaic Bayer", "Nur eine Quad-CFA-Quelle kann Remosaic Bayer exportieren"),
  "backend.exportMonoDemosaic": message("A Mono source cannot export Demosaic RGB", "Mono 来源不支持 Demosaic RGB 导出", "Mono 來源不支援 Demosaic RGB 匯出", "Mono ソースは Demosaic RGB を出力できません", "Una fuente Mono no puede exportar Demosaic RGB", "Une source Mono ne peut pas exporter Demosaic RGB", "Eine Mono-Quelle kann kein Demosaic RGB exportieren"),
  "backend.exportInvalidAlignment": message("Output row and frame alignment must be greater than 0", "输出行对齐和帧对齐必须大于 0", "輸出列與影格對齊必須大於 0", "出力の行・フレームアラインメントは 0 より大きい必要があります", "La alineación de fila y fotograma debe ser mayor que 0", "L’alignement de ligne et d’image doit être supérieur à 0", "Ausgabezeilen- und Frame-Ausrichtung müssen größer als 0 sein"),
  "warning.emptyDimensions": message("Valid width and height must be greater than 0", "有效宽度和高度必须大于 0", "有效寬度與高度必須大於 0", "有効な幅と高さは 0 より大きい必要があります", "La anchura y altura válidas deben ser mayores que 0", "La largeur et la hauteur utiles doivent être supérieures à 0", "Gültige Breite und Höhe müssen größer als 0 sein"),
  "warning.invalidBitDepth": message("Bit depth must be from 8 to 16 bits", "位深必须在 8 到 16 bit 之间", "位元深度必須介於 8 至 16 bit", "ビット深度は 8～16 bit である必要があります", "La profundidad de bits debe estar entre 8 y 16", "La profondeur de bits doit être comprise entre 8 et 16", "Bittiefe muss zwischen 8 und 16 Bit liegen"),
  "warning.containerTooSmall": message("An 8-bit container cannot hold values above 8 bits; only the low 8 bits will be read", "8-bit 容器无法保存超过 8 bit 的像素，显示时只读取低 8 bit", "8-bit 容器無法保存超過 8 bit 的像素，顯示時僅讀取低 8 bit", "8-bit コンテナは 8 bit を超える値を保持できないため、下位 8 bit のみ読み取ります", "Un contenedor de 8 bits no admite valores superiores; solo se leerán los 8 bits bajos", "Un conteneur 8 bits ne peut pas contenir de valeurs supérieures ; seuls les 8 bits faibles seront lus", "Ein 8-Bit-Container kann keine höheren Werte speichern; nur die unteren 8 Bit werden gelesen"),
  "warning.packingDepthMismatch": message("{packing} uses a fixed bit depth; the configured {bitDepth}-bit depth does not match", "{packing} 使用固定位深解码；当前 {bitDepth} bit 设置与打包格式不一致", "{packing} 使用固定位元深度解碼；目前 {bitDepth} bit 設定與打包格式不符", "{packing} は固定ビット深度です。設定された {bitDepth} bit と一致しません", "{packing} usa una profundidad fija; la configuración de {bitDepth} bits no coincide", "{packing} utilise une profondeur fixe ; le réglage {bitDepth} bits ne correspond pas", "{packing} verwendet eine feste Bittiefe; die Einstellung {bitDepth} Bit stimmt nicht überein"),
  "warning.shortRowStride": message("Row stride {rowStride} B is smaller than the minimum row size {rowBytes} B; rows may overlap, but display will be attempted", "行步长 {rowStride} B 小于有效行最小大小 {rowBytes} B；相邻行可能重叠，仍将尝试显示", "列步幅 {rowStride} B 小於有效列最小大小 {rowBytes} B；相鄰列可能重疊，仍將嘗試顯示", "行ストライド {rowStride} B は最小行サイズ {rowBytes} B 未満です。行が重なる可能性がありますが表示を試みます", "El stride {rowStride} B es menor que el mínimo {rowBytes} B; las filas pueden solaparse", "Le pas de ligne {rowStride} o est inférieur au minimum {rowBytes} o ; les lignes peuvent se chevaucher", "Zeilen-Stride {rowStride} B ist kleiner als {rowBytes} B; Zeilen können sich überlappen"),
  "warning.shortFrameStride": message("Frame stride {frameStride} B is smaller than frame data size {frameBytes} B; frames may overlap", "帧步长 {frameStride} B 小于帧数据大小 {frameBytes} B；相邻帧可能重叠", "影格步幅 {frameStride} B 小於影格資料大小 {frameBytes} B；相鄰影格可能重疊", "フレームストライド {frameStride} B はデータサイズ {frameBytes} B 未満で、フレームが重なる可能性があります", "El stride de fotograma {frameStride} B es menor que {frameBytes} B; pueden solaparse", "Le pas d’image {frameStride} o est inférieur à {frameBytes} o ; les images peuvent se chevaucher", "Frame-Stride {frameStride} B ist kleiner als {frameBytes} B; Frames können sich überlappen"),
  "warning.headerOutside": message("The file header offset is beyond the end of the file", "文件头偏移已超过文件末尾", "檔頭偏移已超過檔案結尾", "ファイルヘッダーオフセットがファイル末尾を超えています", "El desplazamiento de cabecera supera el final del archivo", "Le décalage d’en-tête dépasse la fin du fichier", "Dateikopf-Offset liegt hinter dem Dateiende"),
  "warning.noFrame": message("The current parameters cannot locate a decodable frame", "当前参数无法定位可解码帧", "目前參數無法定位可解碼影格", "現在のパラメーターではデコード可能なフレームを特定できません", "Los parámetros actuales no permiten localizar un fotograma decodificable", "Les paramètres actuels ne permettent pas de localiser une image décodable", "Mit den aktuellen Parametern kann kein dekodierbarer Frame gefunden werden"),
  "warning.partialFirst": message("The file is shorter than one frame; readable data from the first frame will be shown", "文件不足一帧，将显示第一帧中可读取的部分", "檔案不足一個影格，將顯示第一影格中可讀取的部分", "ファイルが 1 フレーム未満のため、先頭フレームの読取可能部分を表示します", "El archivo no completa un fotograma; se mostrará la parte legible", "Le fichier est plus court qu’une image ; la partie lisible sera affichée", "Datei ist kürzer als ein Frame; lesbarer Teil des ersten Frames wird angezeigt"),
  "warning.partialLast": message("{trailingBytes} B remain after complete frames and will be shown as a partial final frame", "完整帧后还剩 {trailingBytes} B，将其作为不完整的末帧显示", "完整影格後尚餘 {trailingBytes} B，將作為不完整的最後影格顯示", "完全なフレームの後に {trailingBytes} B 残っており、不完全な最終フレームとして表示します", "Quedan {trailingBytes} B y se mostrarán como fotograma final incompleto", "Il reste {trailingBytes} o, affichés comme dernière image partielle", "{trailingBytes} B verbleiben und werden als unvollständiger letzter Frame angezeigt"),
  "warning.multipleFrames": message("{frameCount} frames were identified with the current parameters", "按当前参数识别到 {frameCount} 帧", "依目前參數識別到 {frameCount} 個影格", "現在のパラメーターで {frameCount} フレームを検出しました", "Se identificaron {frameCount} fotogramas", "{frameCount} images ont été identifiées", "{frameCount} Frames wurden erkannt"),
} as const;

export type MessageKey = keyof typeof CATALOG;

const LOCALE_NAMES: Record<ResolvedLocale, string> = {
  en: "English",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  ja: "日本語",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
};

const trackedText = new Map<Text, MessageKey>();
const trackedAttributes = new Map<Element, Map<string, MessageKey>>();
const keyByLocalizedText = new Map<string, MessageKey>();

for (const [key, entry] of Object.entries(CATALOG) as Array<[MessageKey, Entry]>) {
  for (const value of Object.values(entry)) {
    if (value && !value.includes("{")) keyByLocalizedText.set(value, key);
  }
}

let preference: LanguagePreference = "system";
let locale: ResolvedLocale = "en";

function normalizeLanguageTag(tag: string): ResolvedLocale | null {
  const normalized = tag.trim().replace(/_/g, "-").toLowerCase();
  if (!normalized) return null;
  if (normalized === "zh-hant" || normalized.startsWith("zh-hant-")
    || /^(zh-(tw|hk|mo))($|-)/.test(normalized)) return "zh-TW";
  if (normalized === "zh" || normalized === "zh-hans" || normalized.startsWith("zh-hans-")
    || /^(zh-(cn|sg))($|-)/.test(normalized)) return "zh-CN";
  if (normalized === "ja" || normalized.startsWith("ja-")) return "ja";
  if (normalized === "es" || normalized.startsWith("es-")) return "es";
  if (normalized === "fr" || normalized.startsWith("fr-")) return "fr";
  if (normalized === "de" || normalized.startsWith("de-")) return "de";
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  return null;
}

export function resolveSystemLocale(languages: readonly string[] = navigator.languages): ResolvedLocale {
  for (const language of languages) {
    const resolved = normalizeLanguageTag(language);
    if (resolved) return resolved;
  }
  return "en";
}

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === "system" || Object.hasOwn(LOCALE_NAMES, String(value));
}

export function setLanguagePreference(value: LanguagePreference): ResolvedLocale {
  preference = value;
  locale = value === "system" ? resolveSystemLocale() : value;
  document.documentElement.lang = locale;
  return locale;
}

export function getLanguagePreference(): LanguagePreference {
  return preference;
}

export function getResolvedLocale(): ResolvedLocale {
  return locale;
}

export function getLocaleName(value: ResolvedLocale): string {
  return LOCALE_NAMES[value];
}

export function getLanguageOptions(): ReadonlyArray<{ value: LanguagePreference; label: string }> {
  return [
    { value: "system", label: `${t("language.system")} · ${getLocaleName(resolveSystemLocale())}` },
    ...(["en", "zh-CN", "zh-TW", "ja", "es", "fr", "de"] as const)
      .map((value) => ({ value, label: LOCALE_NAMES[value] })),
  ];
}

export function t(key: MessageKey, values: MessageValues = {}): string {
  const template = CATALOG[key][locale] ?? CATALOG[key].en;
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name: string) => (
    Object.hasOwn(values, name) ? String(values[name]) : match
  ));
}

export function hasMessage(key: string): key is MessageKey {
  return Object.hasOwn(CATALOG, key);
}

export function validateCatalog(): string[] {
  const issues: string[] = [];
  for (const [key, entry] of Object.entries(CATALOG) as Array<[MessageKey, Entry]>) {
    for (const language of Object.keys(LOCALE_NAMES) as ResolvedLocale[]) {
      if (!entry[language].trim()) issues.push(`${key}:${language}`);
    }
  }
  return issues;
}

export function formatDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatTime(value: Date): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(value);
}

function translatedTextKey(value: string): MessageKey | undefined {
  return keyByLocalizedText.get(value.trim());
}

function replacePreservingWhitespace(value: string, replacement: string): string {
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  return `${leading}${replacement}${trailing}`;
}

export function localizeTree(root: ParentNode): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const existing = trackedText.get(textNode);
    const key = existing ?? translatedTextKey(textNode.nodeValue ?? "");
    if (key) {
      trackedText.set(textNode, key);
      textNode.nodeValue = replacePreservingWhitespace(textNode.nodeValue ?? "", t(key));
    }
    node = walker.nextNode();
  }

  const elements = root instanceof Element
    ? [root, ...root.querySelectorAll("*")]
    : [...root.querySelectorAll("*")];
  for (const element of elements) {
    const keys = trackedAttributes.get(element) ?? new Map<string, MessageKey>();
    for (const attribute of ["title", "aria-label", "placeholder", "data-help"]) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const key = keys.get(attribute) ?? translatedTextKey(value);
      if (key) {
        keys.set(attribute, key);
        element.setAttribute(attribute, t(key));
      }
    }
    if (keys.size) trackedAttributes.set(element, keys);
  }
}

export function refreshLocalizedTree(): void {
  for (const [node, key] of trackedText) {
    if (node.isConnected) node.nodeValue = replacePreservingWhitespace(node.nodeValue ?? "", t(key));
  }
  for (const [element, attributes] of trackedAttributes) {
    if (!element.isConnected) continue;
    for (const [attribute, key] of attributes) element.setAttribute(attribute, t(key));
  }
}
