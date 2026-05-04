import { defineLocale, getCurrentLocale, setLocale } from "../locale";

// Only register locales whose weekday names would falsely match English weekdays
// when the locale falls back to English. For example, "fr" in hr locale should
// NOT match any weekday, but without locale data it falls back to en where "Fr"
// matches Friday.
const localeData: Record<string, { weekdaysMin: string[]; weekdaysShort: string[]; weekdays: string[]; calendar?: Record<string, string> }> = {
  bs: {
    weekdays: "nedjelja_ponedjeljak_utorak_srijeda_četvrtak_petak_subota".split("_"),
    weekdaysShort: "ned._pon._uto._sri._čet._pet._sub.".split("_"),
    weekdaysMin: "ne_po_ut_sr_če_pe_su".split("_"),
  },
  ca: {
    weekdays: "diumenge_dilluns_dimarts_dimecres_dijous_divendres_dissabte".split("_"),
    weekdaysShort: "dg._dl._dt._dc._dj._dv._ds.".split("_"),
    weekdaysMin: "dg_dl_dt_dc_dj_dv_ds".split("_"),
  },
  eu: {
    weekdays: "igandea_astelehena_asteartea_asteazkena_osteguna_ostirala_larunbata".split("_"),
    weekdaysShort: "ig._al._ar._az._og._ol._lr.".split("_"),
    weekdaysMin: "ig_al_ar_az_og_ol_lr".split("_"),
  },
  fr: {
    weekdays: "dimanche_lundi_mardi_mercredi_jeudi_vendredi_samedi".split("_"),
    weekdaysShort: "dim._lun._mar._mer._jeu._ven._sam.".split("_"),
    weekdaysMin: "di_lu_ma_me_je_ve_sa".split("_"),
    calendar: {
      sameDay: "[Aujourd'hui à] LT",
      nextDay: "[Demain à] LT",
      nextWeek: "dddd [à] LT",
      lastDay: "[Hier à] LT",
      lastWeek: "dddd [dernier à] LT",
      sameElse: "L",
    },
  },
  fy: {
    weekdays: "snein_moandei_tiisdei_woansdei_tongersdei_freed_sneon".split("_"),
    weekdaysShort: "si._mo._ti._wo._to._fr._so.".split("_"),
    weekdaysMin: "Si_Mo_Ti_Wo_To_Fr_So".split("_"),
  },
  gl: {
    weekdays: "domingo_luns_martes_mércores_xoves_venres_sábado".split("_"),
    weekdaysShort: "dom._lun._mar._mér._xov._ven._sáb.".split("_"),
    weekdaysMin: "do_lu_ma_mé_xo_ve_sá".split("_"),
  },
  "gom-deva": {
    weekdays: "आयतार_सोमार_मंगळार_बुधवार_बिरेस्तार_सुक्रार_शेनवार".split("_"),
    weekdaysShort: "आयत._सोम._मंगळ._बुध._ब्रेस्त._सुक्र._शेन.".split("_"),
    weekdaysMin: "आ_सो_मं_बु_ब्रे_सु_शे".split("_"),
  },
  "gom-latn": {
    weekdays: "Aitar_Somar_Mongllar_Budhvar_Birestar_Sukrar_Sonnvar".split("_"),
    weekdaysShort: "Ait._Som._Mon._Bud._Bre._Suk._Son.".split("_"),
    weekdaysMin: "Ai_Sm_Mo_Bu_Br_Su_Sn".split("_"),
  },
  hr: {
    weekdays: "nedjelja_ponedjeljak_utorak_srijeda_četvrtak_petak_subota".split("_"),
    weekdaysShort: "ned._pon._uto._sri._čet._pet._sub.".split("_"),
    weekdaysMin: "ne_po_ut_sr_če_pe_su".split("_"),
  },
  hu: {
    weekdays: "vasárnap_hétfő_kedd_szerda_csütörtök_péntek_szombat".split("_"),
    weekdaysShort: "vas_hét_kedd_sze_csüt_pén_szo".split("_"),
    weekdaysMin: "v_h_k_sze_cs_p_szo".split("_"),
  },
  id: {
    weekdays: "Minggu_Senin_Selasa_Rabu_Kamis_Jumat_Sabtu".split("_"),
    weekdaysShort: "Min_Sen_Sel_Rab_Kam_Jum_Sab".split("_"),
    weekdaysMin: "Mg_Sn_Sl_Rb_Km_Jm_Sb".split("_"),
  },
  lb: {
    weekdays: "Sonndeg_Méindeg_Dënschdeg_Mëttwoch_Donneschdeg_Freideg_Samschdeg".split("_"),
    weekdaysShort: "So._Mé._Dë._Më._Do._Fr._Sa.".split("_"),
    weekdaysMin: "So_Mé_Dë_Më_Do_Fr_Sa".split("_"),
  },
  me: {
    weekdays: "nedjelja_ponedjeljak_utorak_srijeda_četvrtak_petak_subota".split("_"),
    weekdaysShort: "ned._pon._uto._sri._čet._pet._sub.".split("_"),
    weekdaysMin: "ne_po_ut_sr_če_pe_su".split("_"),
  },
  nb: {
    weekdays: "søndag_mandag_tirsdag_onsdag_torsdag_fredag_lørdag".split("_"),
    weekdaysShort: "sø._ma._ti._on._to._fr._lø.".split("_"),
    weekdaysMin: "sø_ma_ti_on_to_fr_lø".split("_"),
  },
  ne: {
    weekdays: "आइतबार_सोमबार_मङ्गलबार_बुधबार_बिहिबार_शुक्रबार_शनिबार".split("_"),
    weekdaysShort: "आइत._सोम._मङ्गल._बुध._बिहि._शुक्र._शनि.".split("_"),
    weekdaysMin: "आ._सो._मं._बु._बि._शु._श.".split("_"),
  },
  nn: {
    weekdays: "søndag_måndag_tysdag_onsdag_torsdag_fredag_laurdag".split("_"),
    weekdaysShort: "su._må._ty._on._to._fr._lau.".split("_"),
    weekdaysMin: "su_må_ty_on_to_fr_la".split("_"),
  },
  "oc-lnc": {
    weekdays: "dimenge_diluns_dimars_dimècres_dijòus_divendres_dissabte".split("_"),
    weekdaysShort: "dg._dl._dm._dc._dj._dv._ds.".split("_"),
    weekdaysMin: "dg_dl_dm_dc_dj_dv_ds".split("_"),
  },
  sl: {
    weekdays: "nedelja_ponedeljek_torek_sreda_četrtek_petek_sobota".split("_"),
    weekdaysShort: "ned._pon._tor._sre._čet._pet._sob.".split("_"),
    weekdaysMin: "ne_po_to_sr_če_pe_so".split("_"),
  },
  sr: {
    weekdays: "nedelja_ponedeljak_utorak_sreda_četvrtak_petak_subota".split("_"),
    weekdaysShort: "ned._pon._uto._sre._čet._pet._sub.".split("_"),
    weekdaysMin: "ne_po_ut_sr_če_pe_su".split("_"),
  },
  "sr-cyrl": {
    weekdays: "недеља_понедељак_уторак_среда_четвртак_петак_субота".split("_"),
    weekdaysShort: "нед._пон._уто._сре._чет._пет._суб.".split("_"),
    weekdaysMin: "не_по_ут_ср_че_пе_су".split("_"),
  },
};

const alreadyRegistered = new Set(["en", "de", "ja"]);

export function registerTestLocales(): void {
  const prevLocale = getCurrentLocale();
  for (const [name, data] of Object.entries(localeData)) {
    if (alreadyRegistered.has(name)) {continue;}
    const cfg: Record<string, any> = {
      weekdays: data.weekdays,
      weekdaysShort: data.weekdaysShort,
      weekdaysMin: data.weekdaysMin,
    };
    if (data.calendar) {cfg.calendar = data.calendar;}
    defineLocale(name, cfg);
  }
  setLocale(prevLocale);
}
