from pathlib import Path

import qrcode


TARGET_URL = "https://amazer.store/"
OUTPUT = Path(r"C:\Users\User\Documents\amazer savegarde\output\qr-amazer-statique.png")
DESKTOP_OUTPUT = Path(r"C:\Users\User\Desktop\qr-amazer-statique.png")


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=24,
        border=4,
    )
    qr.add_data(TARGET_URL)
    qr.make(fit=True)

    image = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    image.save(OUTPUT, format="PNG", optimize=True)
    image.save(DESKTOP_OUTPUT, format="PNG", optimize=True)

    print(OUTPUT)
    print(DESKTOP_OUTPUT)


if __name__ == "__main__":
    main()
