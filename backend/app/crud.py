from sqlalchemy.orm import Session
from . import models, schemas

# Magasin
def create_magasin(db: Session, magasin: schemas.MagasinCreate):
    db_magasin = models.Magasin(**magasin.dict())
    db.add(db_magasin)
    db.commit()
    db.refresh(db_magasin)
    return db_magasin

def get_magasins(db: Session):
    return db.query(models.Magasin).all()

# Produit
def create_produit(db: Session, produit: schemas.ProduitCreate):
    db_produit = models.Produit(**produit.dict())
    db.add(db_produit)
    db.commit()
    db.refresh(db_produit)
    return db_produit

def get_produits(db: Session):
    return db.query(models.Produit).all()

# Prix
def create_prix(db: Session, prix: schemas.PrixCreate):
    db_prix = models.Prix(**prix.dict())
    db.add(db_prix)
    db.commit()
    db.refresh(db_prix)
    return db_prix

def get_prix(db: Session):
    return db.query(models.Prix).all()