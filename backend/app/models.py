from sqlalchemy import Column, Integer, String, Float, ForeignKey
from .database import Base

class Magasin(Base):
    __tablename__ = "magasins"
    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String, unique=True, index=True)
    adresse = Column(String)

class Produit(Base):
    __tablename__ = "produits"
    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String, index=True)
    description = Column(String)

class Prix(Base):
    __tablename__ = "prix"
    id = Column(Integer, primary_key=True, index=True)
    produit_id = Column(Integer, ForeignKey("produits.id"))
    magasin_id = Column(Integer, ForeignKey("magasins.id"))
    prix = Column(Float)