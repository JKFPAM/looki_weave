Promise.all([300,400].map(w=>document.fonts.load(w+' 22px Haffer'))).then(()=>window.loom?.render());
