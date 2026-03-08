from pydantic import BaseModel

class MagasinBase(BaseModel):
    nom: str
    adresse: str

class MagasinCreate(MagasinBase):
    pass

class ProduitBase(BaseModel):
    nom: str
    description: str

class ProduitCreate(ProduitBase):
    pass

class PrixBase(BaseModel):
    produit_id: int
    magasin_id: int
    prix: float

class PrixCreate(PrixBase):
    pass