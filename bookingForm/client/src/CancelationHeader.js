import React from "react";

export default () => {
  return (
    <div style={{ marginBottom: 10 }}>
      <h1 className="h1">
      <svg id="logo" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M21 19.1H3V5h18v14.1zM21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/><path d="M14.59 8L12 10.59 9.41 8 8 9.41 10.59 12 8 14.59 9.41 16 12 13.41 14.59 16 16 14.59 13.41 12 16 9.41z"/></svg>
        Cancella una prenotazione
      </h1>
      <p className="fieldInfo" style={{ fontSize: 14, lineHeight: 1.3}}>
        I campi contrassegnati con * sono obbligatori
      </p>
    </div>
  );
};
