#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 est nécessaire. Installez-le depuis https://www.python.org/downloads/"
  read -r -p "Appuyez sur Entrée pour fermer. "
  exit 1
fi
python3 start_studio.py
