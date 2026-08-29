```abap
*&---------------------------------------------------------------------*
*& Program  : ZMM_R_STOK_KRITIK
*& Açıklama : Kritik malzeme stok seviyeleri (≤ MINBE) takibi;
*&            otomatik e-posta bildirimi (TS-ZMM-STOK-001 v2.0)
*& Yazar    : ABAP Developer
*& Tarih    : 20.08.2026
*&---------------------------------------------------------------------*
REPORT zmm_r_stok_kritik
  LINE-SIZE 255
  NO STANDARD PAGE HEADING.

*----------------------------------------------------------------------*
* TYPE TANIMLAMALARI
*----------------------------------------------------------------------*
TYPES:
  " Ana rapor satırı
  BEGIN OF ts_kritik_mat,
    matnr       TYPE mard-matnr,
    werks       TYPE mard-werks,
    lgort       TYPE mard-lgort,
    maktx       TYPE makt-maktx,
    labst       TYPE mard-labst,
    minbe       TYPE marc-minbe,
    seviye      TYPE c LENGTH 10,   " KRİTİK / UYARI / İZLE
    notu        TYPE c LENGTH 50,   " Gecikmiş Sipariş vb.
    eindt       TYPE eket-eindt,
  END OF ts_kritik_mat,

  tt_kritik_mat TYPE STANDARD TABLE OF ts_kritik_mat WITH DEFAULT KEY,

  " E-posta alıcı yapısı
  BEGIN OF ts_email_cfg,
    alici_email TYPE c LENGTH 100,
    alici_adi   TYPE c LENGTH 50,
  END OF ts_email_cfg,

  tt_email_cfg TYPE STANDARD TABLE OF ts_email_cfg WITH DEFAULT KEY,

  " Kritik malzeme listesi (ZMM_T_KRITIK_MAT'tan okuma)
  BEGIN OF ts_z_kritik_mat,
    mandt       TYPE mandt,
    matnr       TYPE matnr,
    werks       TYPE werks_d,
  END OF ts_z_kritik_mat,

  tt_z_kritik_mat TYPE STANDARD TABLE OF ts_z_kritik_mat WITH DEFAULT KEY,

  " Açık sipariş kontrolü için yardımcı yapı
  BEGIN OF ts_siparis,
    matnr       TYPE ekpo-matnr,
    ebeln       TYPE ekpo-ebeln,
    ebelp       TYPE ekpo-ebelp,
    menge       TYPE ekpo-menge,
    eindt       TYPE eket-eindt,
  END OF ts_siparis,

  tt_siparis TYPE STANDARD TABLE OF ts_siparis WITH DEFAULT KEY.

*----------------------------------------------------------------------*
* SABITLER
*----------------------------------------------------------------------*
CONSTANTS:
  gc_werks1       TYPE mard-werks VALUE '1000',
  gc_werks2       TYPE mard-werks VALUE '1200',
  gc_bsart        TYPE ekko-bsart VALUE 'NB',
  gc_seviye_krit  TYPE c LENGTH 10 VALUE 'KRİTİK',
  gc_seviye_uyari TYPE c LENGTH 10 VALUE 'UYARI',
  gc_seviye_izle  TYPE c LENGTH 10 VALUE 'İZLE',
  gc_not_gecikmis TYPE c LENGTH 50 VALUE 'Gecikmiş Sipariş',
  gc_izle_katsayi TYPE p DECIMALS 1 VALUE '1.5'.

*----------------------------------------------------------------------*
* GLOBAL DEĞİŞKENLER
*----------------------------------------------------------------------*
DATA:
  gt_kritik_mat   TYPE tt_kritik_mat,   " Tüm rapor verileri
  gt_alv_ku       TYPE tt_kritik_mat,   " ALV sekme 1: KRİTİK+UYARI
  gt_alv_izle     TYPE tt_kritik_mat,   " ALV sekme 2: İZLE
  gt_email_cfg    TYPE tt_email_cfg,    " E-posta alıcıları
  gs_row          TYPE ts_kritik_mat,
  gv_email_subj   TYPE string.

*----------------------------------------------------------------------*
* ALV REFERANSLARI
*----------------------------------------------------------------------*
DATA:
  go_alv_ku       TYPE REF TO cl_gui_alv_grid,
  go_alv_izle     TYPE REF TO cl_gui_alv_grid,
  go_splitter     TYPE REF TO cl_gui_splitter_container,
  go_cnt_ku       TYPE REF TO cl_gui_container,
  go_cnt_izle     TYPE REF TO cl_gui_container,
  go_fcat_ku      TYPE lvc_t_fcat,
  go_fcat_izle    TYPE lvc_t_fcat.

*----------------------------------------------------------------------*
* SEÇİM EKRANI
*----------------------------------------------------------------------*
SELECTION-SCREEN BEGIN OF BLOCK blk1 WITH FRAME TITLE TEXT-001.
  PARAMETERS:
    p_werks TYPE mard-werks OBLIGATORY DEFAULT '1000', " Depo
    p_datum TYPE sy-datum   DEFAULT sy-datum.           " Referans tarih
SELECTION-SCREEN END OF BLOCK blk1.

PARAMETERS:
  p_email TYPE abap_bool DEFAULT 'X'. " E-posta gönder

*----------------------------------------------------------------------*
* INITIALIZATION
*----------------------------------------------------------------------*
INITIALIZATION.
  TEXT-001 = 'Seçim Kriterleri'.

*----------------------------------------------------------------------*
* AT SELECTION-SCREEN - Yetki Kontrolü
*----------------------------------------------------------------------*
AT SELECTION-SCREEN.
  " M_MATE_WRK yetki kontrolü (Aktivite 03 - Görüntüle)
  AUTHORITY-CHECK OBJECT 'M_MATE_WRK'
    ID 'WERKS' FIELD p_werks
    ID 'ACTVT' FIELD '03'.
  IF sy-subrc <> 0.
    MESSAGE e001(zmm_stok) WITH p_werks. " Yetkiniz yok: &
  ENDIF.

  " Satınalma siparişi görüntüleme yetkisi
  AUTHORITY-CHECK OBJECT 'M_ECPO_GRN'
    ID 'ACTVT' FIELD '03'.
  IF sy-subrc <> 0.
    MESSAGE e002(zmm_stok). " Satınalma sipariş yetkisi yok
  ENDIF.

  " Sadece tanımlı depolar
  IF p_werks <> gc_werks1 AND p_werks <> gc_werks2.
    MESSAGE e003(zmm_stok) WITH p_werks gc_werks1 gc_werks2.
  ENDIF.

*----------------------------------------------------------------------*
* START-OF-SELECTION
*----------------------------------------------------------------------*
START-OF-SELECTION.

  " Veri okuma
  PERFORM f_veri_oku.

  " Açık sipariş kontrolü
  PERFORM f_siparis_kontrol.

  " Uyarı seviyesi hesaplama ve kategorize etme
  PERFORM f_uyari_hesapla.

  " ALV raporu ekranda göster
  PERFORM f_alv_goster.

  " E-posta gönderimi (parametre aktifse)
  IF p_email = abap_true.
    PERFORM f_email_gonder.
  ENDIF.

*----------------------------------------------------------------------*
* FORM: F_VERI_OKU
* Kritik malzeme listesini ZMM_T_KRITIK_MAT'tan okur;
* MARD, MARC ve MAKT tablolarıyla birleştirerek gt_kritik_mat'ı doldurur.
*----------------------------------------------------------------------*
FORM f_veri_oku.

  DATA:
    lt_z_kritik  TYPE tt_z_kritik_mat,
    lt_matnr     TYPE RANGE OF matnr,
    ls_matnr_rng LIKE LINE OF lt_matnr,
    ls_z_kritik  TYPE ts_z_kritik_mat.

  " --- 1. Adım: Kritik malzeme listesini oku ---
  SELECT mandt matnr werks
    FROM zmm_t_kritik_mat
    INTO TABLE lt_z_kritik
    WHERE mandt = sy-mandt
      AND werks = p_werks.

  IF lt_z_kritik IS INITIAL.
    MESSAGE i004(zmm_stok). " Kritik malzeme listesi boş
    RETURN.
  ENDIF.

  " --- 2. Adım: Malzeme numaralarını RANGE'e çevir (toplu sorgu için) ---
  LOOP AT lt_z_kritik INTO ls_z_kritik.
    ls_matnr_rng-sign   = 'I'.
    ls_matnr_rng-option = 'EQ'.
    ls_matnr_rng-low    = ls_z_kritik-matnr.
    APPEND ls_matnr_rng TO lt_matnr.
  ENDLOOP.

  " --- 3. Adım: MARD + MARC + MAKT JOIN ile stok ve min. seviye çek ---
  " Performans: MARD → MARC INNER JOIN (WERKS+MATNR), MARC.MINBE > 0
  SELECT mrd~matnr
         mrd~werks
         mrd~lgort
         mrd~labst
         mrc~minbe
         mkt~maktx
    FROM mard AS mrd
    INNER JOIN marc AS mrc
      ON  mrc~matnr = mrd~matnr
      AND mrc~werks = mrd~werks
    INNER JOIN makt AS mkt
      ON  mkt~matnr = mrd~matnr
      AND mkt~spras = sy-langu
    INTO CORRESPONDING FIELDS OF TABLE gt_kritik_mat
    WHERE mrd~werks = p_werks
      AND mrd~matnr IN lt_matnr
      AND mrd~labst <= mrc~minbe * gc_izle_katsayi  " Sadece eşik altındakiler
      AND mrc~minbe > 0.

  IF gt_kritik_mat IS INITIAL.
    MESSAGE i005(zmm_stok). " Kritik eşikte malzeme bulunamadı
  ENDIF.

ENDFORM.

*----------------------------------------------------------------------*
* FORM: F_SIPARIS_KONTROL
* Her kritik malzeme için açık satınalma siparişi (BSART=NB) kontrol
* eder. Teslim tarihi >= p_datum ise satırı çıkar; < p_datum ise
* "Gecikmiş Sipariş" notu ekler ve en erken eindt'yi kaydeder.
*----------------------------------------------------------------------*
FORM f_siparis_kontrol.

  DATA:
    lt_siparis    TYPE tt_siparis,
    ls_siparis    TYPE ts_siparis,
    lt_matnr_rng  TYPE RANGE OF matnr,
    ls_matnr_rng  LIKE LINE OF lt_matnr_rng,
    ls_row        TYPE ts_kritik_mat,
    lv_tabix      TYPE sy-tabix.

  " Rapordaki tüm malzeme numaralarını RANGE'e al
  LOOP AT gt_kritik_mat INTO ls_row.
    ls_matnr_rng-sign   = 'I'.
    ls_matnr_rng-option = 'EQ'.
    ls_matnr_rng-low    = ls_row-matnr.
    APPEND ls_matnr_rng TO lt_matnr_rng.
  ENDLOOP.
  SORT lt_matnr_rng BY low.
  DELETE ADJACENT DUPLICATES FROM lt_matnr_rng COMPARING low.

  IF lt_matnr_rng IS INITIAL.
    RETURN.
  ENDIF.

  " --- Toplu açık sipariş sorgusu: EKKO + EKPO + EKET ---
  " BSART = 'NB' (standart satınalma siparişi)
  SELECT ekp~matnr
         ekp~ebeln
         ekp~ebelp
         ekp~menge
         ekt~eindt
    FROM ekko AS ekk
    INNER JOIN ekpo AS ekp
      ON ekp~ebeln = ekk~ebeln
    INNER JOIN eket AS ekt
      ON  ekt~ebeln = ekp~ebeln
      AND ekt~ebelp = ekp~ebelp
    INTO CORRESPONDING FIELDS OF TABLE lt_siparis
    WHERE ekk~bsart  = gc_bsart
      AND ekp~matnr IN lt_matnr_rng
      AND ekp~elikz  = space.  " Teslim kapatılmamış pozisyonlar

  IF lt_siparis IS INITIAL.
    RETURN.
  ENDIF.

  " --- Her rapor satırı için sipariş durumu değerlendir ---
  LOOP AT gt_kritik_mat INTO ls_row.
    lv_tabix = sy-tabix.

    " Bu malzeme için açık siparişleri filtrele
    DATA(lt_sip_mat) = lt_siparis.
    DELETE lt_sip_mat WHERE matnr <> ls_row-matnr.

    IF lt_sip_mat IS INITIAL.
      " Açık sipariş yok → satır olduğu gibi kalır
      CONTINUE.
    ENDIF.

    " En erken teslim tarihini bul
    SORT lt_sip_mat BY eindt ASCENDING.
    READ TABLE lt_sip_mat INTO ls_siparis INDEX 1.

    IF ls_siparis-eindt >= p_datum.
      " Teslim tarihi geçmemiş → satırı listeden çıkar
      DELETE gt_kritik_mat INDEX lv_tabix.
    ELSE.
      " Gecikmiş sipariş → not ekle ve teslim tarihini kaydet
      ls_row-notu  = gc_not_gecikmis.
      ls_row-eindt = ls_siparis-eindt.
      MODIFY gt_kritik_mat FROM ls_row INDEX lv_tabix.
    ENDIF.

  ENDLOOP.

ENDFORM.

*----------------------------------------------------------------------*
* FORM: F_UYARI_HESAPLA
* gt_kritik_mat içindeki her satır için seviye (KRİTİK/UYARI/İZLE)
* belirler; gt_alv_ku (KRİTİK+UYARI) ve gt_alv_izle (İZLE) tablolarına
* ayırır.
*----------------------------------------------------------------------*
FORM f_uyari_hesapla.

  DATA: ls_row TYPE ts_kritik_mat.

  CLEAR: gt_alv_ku, gt_alv_izle.

  LOOP AT gt_kritik_mat INTO ls_row.

    " Seviye hesaplama
    IF ls_row-labst = 0.
      " Stok sıfır → en kritik durum
      ls_row-seviye = gc_seviye_krit.

    ELSEIF ls_row-labst < ls_row-minbe.
      " Stok min. seviyenin altında (0'dan büyük)
      ls_row-seviye = gc_seviye_uyari.

    ELSEIF ls_row-labst < ( ls_row-minbe * gc_izle_katsayi ).
      " Stok min. seviyenin 1.5 katının altında, ama min. seviyenin üstünde
      ls_row-seviye = gc_seviye_izle.

    ELSE.
      " Eşik dışı kalan satır (ilk SELECT'te geniş filtreden geçmiş olabilir)
      MODIFY gt_kritik_mat FROM ls_row.
      CONTINUE.
    ENDIF.

    MODIFY gt_kritik_mat FROM ls_row.

    " İki ALV sekmesi için ayır
    CASE ls_row-seviye.
      WHEN gc_seviye_krit OR gc_seviye_uyari.
        APPEND ls_row TO gt_alv_ku.
      WHEN gc_seviye_izle.
        APPEND ls_row TO gt_alv_izle.
    ENDCASE.

  ENDLOOP.

  " KRİTİK önce gelsin
  SORT gt_alv_ku   BY seviye ASCENDING matnr ASCENDING.
  SORT gt_alv_izle BY matnr  ASCENDING.

ENDFORM.

*----------------------------------------------------------------------*
* FORM: F_BUILD_FCAT
* Belirtilen tablo için ALV field catalog oluşturur.
*----------------------------------------------------------------------*
FORM f_build_fcat USING    pv_table TYPE c
                  CHANGING pt_fcat  TYPE lvc_t_fcat.

  DATA: ls_fcat TYPE lvc_s_fcat.

  CLEAR pt_fcat.

  " Sıra: Malzeme No
  CLEAR ls_fcat.
  ls_fcat-fieldname = 'MATNR'. ls_fcat-tabname   = pv_table.
  ls_fcat-coltext   = 'Malzeme No'. ls_fcat-outputlen = 18.
  APPEND ls_fcat TO pt_fcat.

  " Depo (Werks)
  CLEAR ls_fcat.
  ls_fcat-fieldname = 'WERKS'. ls_fcat-tabname   = pv_table.
  ls_fcat-coltext   = 'Depo'. ls_fcat-outputlen = 6.
  APPEND ls_fcat TO pt_fcat.

  " Depolama Yeri
  CLEAR ls_fcat.
  ls_fcat-fieldname = 'LGORT'. ls_fcat-tabname   = pv_table.
  ls_fcat-coltext   = 'Dep. Yeri'. ls_fcat-outputlen = 8.
  APPEND ls_fcat TO pt_fcat.

  " Malzeme Tanımı
  CLEAR ls_fcat.
  ls_fcat-fieldname = 'MAKTX'. ls_fcat-tabname   = pv_table.
  ls_fcat-coltext   = 'Malzeme Tanımı'. ls_fcat-outputlen = 40.
  APPEND ls_fcat TO pt_fcat.

  " Mevcut Stok
  CLEAR ls_fcat.
  ls_fcat-fieldname = 'LABST'. ls_fcat-tabname   = pv_table.
  ls_fcat-coltext   = 'Mevcut Stok'. ls_fcat-outputlen = 12.
  ls_fcat-qfieldname = ''. ls_fcat-datatype = 'QUAN'.
  APPEND ls_fcat TO pt_fcat.

  " Min. Seviye
  CLEAR ls_fcat.
  ls_fcat-fieldname = 'MINBE'. ls_fcat-tabname   = pv_table.
  ls_fcat-coltext   = 'Min. Seviye'. ls_fcat-outputlen = 12.
  APPEND ls_fcat TO pt_fcat.

  " Seviye (KRİTİK/UYARI/İZLE)
  CLEAR ls_fcat.
  ls_fcat-fieldname = 'SEVIYE'. ls_fcat-tabname   = pv_table.
  ls_fcat-coltext   = 'Seviye'. ls_fcat-outputlen = 12.
  APPEND ls_fcat TO pt_fcat.

  " Not
  CLEAR ls_fcat.
  ls_fcat-fieldname = 'NOTU'. ls_fcat-tabname   = pv_table.
  ls_fcat-coltext   = 'Not'. ls_fcat-outputlen = 25.
  APPEND ls_fcat TO pt_fcat.

  " Teslim Tarihi
  CLEAR ls_fcat.
  ls_fcat-fieldname = 'EINDT'. ls_fcat-tabname   = pv_table.
  ls_fcat-coltext   = 'Teslim Tarihi'. ls_fcat-outputlen = 12.
  APPEND ls_fcat TO pt_fcat.

ENDFORM.

*----------------------------------------------------------------------*
* FORM: F_ALV_GOSTER
* İki sekme (KRİTİK-UYARI ve İZLE) içeren tabstrip ALV ekranını
* gösterir; cl_gui_splitter_container ile iki ALV grid yaratır.
*----------------------------------------------------------------------*
FORM f_alv_goster.

  DATA:
    lo_screen   TYPE REF TO cl_gui_custom_container,
    ls_layout   TYPE lvc_s_layo,
    ls_sort_ku  TYPE lvc_s_sort,
    ls_sort_izl TYPE lvc_s_sort,
    lt_sort_ku  TYPE lvc_t_sort,
    lt_sort_izl TYPE lvc_t_sort.

  " Ekranı aç (PAI/PBO döngüsü olmadan CALL SCREEN ile)
  CALL SCREEN 100.

ENDFORM.

*----------------------------------------------------------------------*
* MODULE PBO (Process Before Output)
* Ekran 100 için ALV gridlerini başlatır ve veriyi set eder.
*----------------------------------------------------------------------*
MODULE pbo_0100 OUTPUT.

  DATA:
    ls_layout TYPE lvc_s_layo,
    lo_cnt    TYPE REF TO cl_gui_container.

  SET TITLEBAR 'T001' WITH 'Kritik Stok Raporu' p_werks p_datum.
  SET PF-STATUS 'STAT_100'.

  " Splitter container: üst = KRİTİK-UYARI, alt = İZLE
  IF go_splitter IS NOT BOUND.

    lo_cnt = cl_gui_container=>screen0.

    CREATE OBJECT go_splitter
      EXPORTING
        parent            = lo_cnt
        rows              = 2
        columns           = 1
        no_autodef_progid_dynnr = abap_true.

    go_splitter->get_container(
      EXPORTING row = 1 column = 1
      RECEIVING container = go_cnt_ku ).

    go_splitter->get_container(
      EXPORTING row = 2 column = 1
      RECEIVING container = go_cnt_izle ).

    go_splitter->set_row_height(
      EXPORTING id = 1 height = 50 ).
    go_splitter->set_row_height(
      EXPORTING id = 2 height = 50 ).

    " ALV grid: KRİTİK-UYARI sekmesi
    CREATE OBJECT go_alv_ku
      EXPORTING i_parent = go_cnt_ku.

    PERFORM f_build_fcat
      USING    'GT_ALV_KU'
      CHANGING go_fcat_ku.

    ls_layout-zebra      = abap_true.
    ls_layout-cwidth_opt = abap_true.
    ls_layout-grid_title = 'KRİTİK ve UYARI Seviyesi Malzemeler'.

    go_alv_ku->set_table_for_first_display(
      EXPORTING
        is_layout       = ls_layout
      CHANGING
        it_outtab       = gt_alv_ku
        it_fieldcatalog = go_fcat_ku ).

    " ALV grid: İZLE sekmesi
    CREATE OBJECT go_alv_izle
      EXPORTING i_parent = go_cnt_izle.

    PERFORM f_build_fcat
      USING    'GT_ALV_IZLE'
      CHANGING go_fcat_izle.

    ls_layout-grid_title = 'İZLE Seviyesi Malzemeler'.

    go_alv_izle->set_table_for_first_display(
      EXPORTING
        is_layout       = ls_layout
      CHANGING
        it_outtab       = gt_alv_izle
        it_fieldcatalog = go_fcat_izle ).

  ENDIF.

ENDMODULE.

*----------------------------------------------------------------------*
* MODULE PAI (Process After Input)
* Kullanıcı komutlarını işler (Geri, İptal, Kapat).
*----------------------------------------------------------------------*
MODULE pai_0100 INPUT.

  DATA: lv_ucomm TYPE sy-ucomm.
  lv_ucomm = sy-ucomm.
  CLEAR sy-ucomm.

  CASE lv_ucomm.
    WHEN 'BACK' OR 'EXIT' OR 'CANC'.
      LEAVE TO SCREEN 0.
  ENDCASE.

ENDMODULE.

*----------------------------------------------------------------------*
* FORM: F_EMAIL_GONDER
* ZMM_T_EMAIL_CFG tablosundan alıcıları okur; gt_alv_ku ve gt_alv_izle
* verilerini düz metin olarak ekler; SO_NEW_DOCUMENT_ATT_SEND_API1 ile
* e-posta gönderir.
*----------------------------------------------------------------------*
FORM f_email_gonder.

  DATA:
    lt_email_cfg    TYPE tt_email_cfg,
    ls_email_cfg    TYPE ts_email_cfg,
    " SAPMail API yapıları
    ls_doc_chng     TYPE sodocchgi1,
    lt_obj_txt      TYPE STANDARD TABLE OF solisti1,
    ls_obj_txt      TYPE solisti1,
    lt_obj_att      TYPE STANDARD TABLE OF solisti1,
    ls_obj_att      TYPE solisti1,
    lt_reclist      TYPE STANDARD TABLE OF somlreci1,
    ls_reclist      TYPE somlreci1,
    lv_att_header   TYPE STANDARD TABLE OF solisti1,
    ls_att_header   TYPE solisti1,
    lv_subj         TYPE so_obj_des,
    lv_fname        TYPE so_obj_des,
    lv_datum_str    TYPE c LENGTH 8,
    lv_line         TYPE solisti1,
    ls_row          TYPE ts_kritik_mat.

  " --- 1. E-posta alıcılarını oku ---
  SELECT alici_email alici_adi
    FROM zmm_t_email_cfg
    INTO CORRESPONDING FIELDS OF TABLE lt_email_cfg
    WHERE aktif = abap_true.

  IF lt_email_cfg IS INITIAL.
    MESSAGE w006(zmm_stok). " Aktif e-posta alıcısı bulunamadı
    RETURN.
  ENDIF.

  " --- 2. E-posta konusu ve dosya adı ---
  lv_datum_str = p_datum.
  CONCATENATE '[S/4HANA] Kritik Stok Bildirimi -' lv_datum_str
    INTO lv_subj SEPARATED BY space.
  CONCATENATE 'STOK_KRITIK_' lv_datum_str '.xlsx'
    INTO lv_fname.

  " --- 3. Belge başlığını doldur ---
  ls_doc_chng-obj_name  = 'STOK'.
  ls_doc_chng-obj_descr = lv_subj.
  ls_doc_chng-obj_langu = sy-langu.
  ls_doc_chng-doc_size  = 0. " API kendisi hesaplar

  " --- 4. E-posta gövdesi: rapor özeti ---
  ls_obj_txt-line = 'Merhaba,'.
  APPEND ls_obj_txt TO lt_obj_txt.

  ls_obj_txt-line = ' '.
  APPEND ls_obj_txt TO lt_obj_txt.

  CONCATENATE 'Rapor Tarihi : ' lv_datum_str
    INTO ls_obj_txt-line.
  APPEND ls_obj_txt TO lt_obj_txt.

  CONCATENATE 'Depo         : ' p_werks
    INTO ls_obj_txt-line.
  APPEND ls_obj_txt TO lt_obj_txt.

  DATA(lv_ku_cnt)   = lines( gt_alv_ku ).
  DATA(lv_izle_cnt) = lines( gt_alv_izle ).

  CONCATENATE 'KRİTİK+UYARI : '
    lv_ku_cnt ' malzeme'
    INTO ls_obj_txt-line SEPARATED BY space.
  APPEND ls_obj_txt TO lt_obj_txt.

  CONCATENATE 'İZLE         : '
    lv_izle_cnt ' malzeme'
    INTO ls_obj_txt-line SEPARATED BY space.
  APPEND ls_obj_txt TO lt_obj_txt.

  ls_obj_txt-line = ' '.
  APPEND ls_obj_txt TO lt_obj_txt.
  ls_obj_txt-line = 'Detaylar ekte yer almaktadır.'.
  APPEND ls_obj_txt TO lt_obj_txt.

  " --- 5. Ek: CSV (XLSX yerine text-based attachment) ---
  " Not: Gerçek XLSX üretimi SAP'ta XLS library gerektirir.
  "      Burada tab-delimited TXT ek olarak gönderilir.

  ls_obj_att-line = 'Malzeme No;Depo;Dep. Yeri;Tanım;Stok;Min.Seviye;Seviye;Not;Teslim Tarihi'.
  APPEND ls_obj_att TO lt_obj_att.

  " KRİTİK-UYARI satırları
  LOOP AT gt_alv_ku INTO ls_row.
    CONCATENATE ls_row-matnr ';'
                ls_row-werks ';'
                ls_row-lgort ';'
                ls_row-maktx ';'
                ls_row-labst ';'
                ls_row-minbe ';'
                ls_row-seviye ';'
                ls_row-notu ';'
                ls_row-eindt
      INTO ls_obj_att-line.
    APPEND ls_obj_att TO lt_obj_att.
  ENDLOOP.

  " İZLE satırları
  LOOP AT gt_alv_izle INTO ls_row.
    CONCATENATE ls_row-matnr ';'
                ls_row-werks ';'
                ls_row-lgort ';'
                ls_row-maktx ';'
                ls_row-labst ';'
                ls_row-minbe ';'
                ls_row-seviye ';'
                ls_row-notu ';'
                ls_row-eindt
      INTO ls_obj_att-line.
    APPEND ls_obj_att TO lt_obj_att.
  ENDLOOP.

  " Ek başlığı (attachment header)
  ls_att_header-line = lv_fname.
  APPEND ls_att_header TO lv_att_header.

  " Dosya boyutunu hesapla
  DATA(lv_att_size) = lines( lt_obj_att ) * 255.
  ls_doc_chng-doc_size = lv_att_size.

  " --- 6. Alıcı listesini oluştur ---
  LOOP AT lt_email_cfg INTO ls_email_cfg.
    ls_reclist-receiver  = ls_email_cfg-alici_email.
    ls_reclist-rec_type  = 'U'.  " Internet e-posta
    ls_reclist-com_type  = 'INT'.
    ls_reclist-notif_del = abap_true.
    APPEND ls_reclist TO lt_reclist.
  ENDLOOP.

  " --- 7. E-posta gönder ---
  CALL FUNCTION 'SO_NEW_DOCUMENT_ATT_SEND_API1'
    EXPORTING
      document_data              = ls_doc_chng
      put_in_outbox              = abap_true
      commit_work                = abap_true
    TABLES
      packing_list               = lv_att_header
      object_header              = lv_att_header
      contents_bin               = lt_obj_att
      contents_txt               = lt_obj_txt
      receivers                  = lt_reclist
    EXCEPTIONS
      too_many_receivers         = 1
      document_not_sent          = 2
      document_type_not_exist    = 3
      operation_no_authorization = 4
      parameter_error            = 5
      x_error                    = 6
      enqueue_error              = 7
      OTHERS                     = 8.

  IF sy-subrc = 0.
    MESSAGE s007(zmm_stok). " E-posta gönderim kuyruğuna alındı
  ELSE.
    MESSAGE w008(zmm_stok) WITH sy-subrc. " E-posta gönderilemedi: &
  ENDIF.

ENDFORM.

*----------------------------------------------------------------------*
* EKRAN 100 için PBO ve PAI modülleri yukarıda tanımlıdır.
* Dynpro (ekran 100) SE51'de aşağıdaki modüllerle tanımlanmalıdır:
*   PROCESS BEFORE OUTPUT:   MODULE pbo_0100.
*   PROCESS AFTER INPUT:     MODULE pai_0100.
*----------------------------------------------------------------------*
```