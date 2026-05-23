# apps/migration/makerlab_migrate/snipeit/upsert.py

import sys
import os
import unicodedata
from typing import Optional, Dict, Any

# Add the apps/api directory to the path to import mappers
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../../api"))
from services.snipeit.mappers import SnipeITUser, SnipeITModel, SnipeITAsset
from .client import DryRunSnipeITClient


def find_or_create_user(
    client: DryRunSnipeITClient,
    email: str,
    name: str,
    username: Optional[str] = None
) -> Optional[SnipeITUser]:
    """Find a user by email or create a new one in Snipe-IT."""
    if not email:
        return None

    # Try to find existing user via the wrapper (respects rate limiting)
    try:
        response = client.get("/api/v1/users", params={"search": email, "limit": 1})
        if "rows" in response and len(response["rows"]) > 0:
            first_user = response["rows"][0]
            # Verify it's an exact match
            if first_user.get("email", "").lower() == email.lower():
                return SnipeITUser(**first_user)
    except Exception:
        pass  # Continue to create if lookup fails

    # Create new user
    payload = {
        "first_name": name.split()[0] if name else "",
        "last_name": " ".join(name.split()[1:]) if name and len(name.split()) > 1 else "",
        "email": email,
        "username": username or email.split("@")[0],
        "password": "ChangeMe123!",  # Default password, user should change on first login
        "password_confirmation": "ChangeMe123!",  # Password confirmation required by Snipe-IT API
        "activated": True
    }

    response = client.post("/api/v1/users", json_data=payload)
    if response and "id" in response:
        return SnipeITUser(
            id=response["id"],
            username=payload["username"],
            name=name,
            email=email
        )

    return None


def find_model_by_model_number(client: DryRunSnipeITClient, model_number: str) -> Optional[SnipeITModel]:
    """Find a Snipe-IT model by model number."""
    try:
        limit = 100
        offset = 0
        
        while True:
            response = client.get("/api/v1/models", params={"search": model_number, "limit": limit, "offset": offset})
            
            if "rows" not in response or not response["rows"]:
                break
                
            for row in response["rows"]:
                if row.get("model_number", "").lower() == model_number.lower():
                    # Extract only the fields we need to avoid Pydantic validation errors
                    return SnipeITModel(
                        id=row["id"],
                        name=row.get("name", ""),
                        model_number=row.get("model_number")
                    )
            
            total = response.get("total", 0)
            offset += limit
            if offset >= total:
                break
                
        return None
    except Exception:
        return None


def find_asset_by_asset_tag(client: DryRunSnipeITClient, asset_tag: str) -> Optional[SnipeITAsset]:
    """Find a Snipe-IT asset by asset tag."""
    try:
        # Use bytag endpoint for exact match
        response = client.get(f"/api/v1/hardware/bytag/{asset_tag}")
        
        if response and "id" in response:
            return SnipeITAsset(
                id=response["id"],
                asset_tag=response.get("asset_tag", ""),
                name=response.get("name"),
                last_checkout=response.get("last_checkout"),
                last_checkin=response.get("last_checkin"),
                expected_checkin=response.get("expected_checkin")
            )
        
        return None
    except Exception:
        return None


def create_model(
    client: DryRunSnipeITClient,
    name: str,
    model_number: str,
    category_id: int,
    manufacturer_id: int,
    price: Optional[float] = None
) -> Optional[SnipeITModel]:
    """Create a new model in Snipe-IT."""
    payload = {
        "name": name,
        "model_number": model_number,
        "category_id": category_id,
        "manufacturer_id": manufacturer_id,
    }
    
    if price is not None:
        payload["purchase_cost"] = str(price)
    
    response = client.post("/api/v1/models", json_data=payload)
    if response:
        # Handle both response formats: {"id": X} and {"payload": {"id": X}}
        model_id = None
        if "payload" in response and isinstance(response["payload"], dict):
            model_id = response["payload"].get("id")
        elif "id" in response:
            model_id = response["id"]
        
        if model_id:
            return SnipeITModel(
                id=model_id,
                name=name,
                model_number=model_number
            )
    
    return None


def update_model(
    client: DryRunSnipeITClient,
    model_id: int,
    name: str,
    model_number: str,
    category_id: int,
    manufacturer_id: int,
    price: Optional[float] = None
) -> Optional[SnipeITModel]:
    """Update an existing model in Snipe-IT."""
    payload = {
        "name": name,
        "model_number": model_number,
        "category_id": category_id,
        "manufacturer_id": manufacturer_id,
    }
    
    if price is not None:
        payload["purchase_cost"] = str(price)
    
    response = client.patch(f"/api/v1/models/{model_id}", json_data=payload)
    if response and "id" in response:
        return SnipeITModel(
            id=response["id"],
            name=name,
            model_number=model_number
        )
    
    return None


def create_asset(
    client: DryRunSnipeITClient,
    model_id: int,
    asset_tag: str,
    name: Optional[str] = None,
    location_id: Optional[int] = None,
    price: Optional[float] = None
) -> Optional[SnipeITAsset]:
    """Create a new asset in Snipe-IT."""
    payload = {
        "model_id": model_id,
        "asset_tag": asset_tag,
        "status_id": 2,  # "Ready to Deploy" (deployable/available)
    }
    
    if name:
        payload["name"] = name
    
    if location_id:
        payload["rtd_location_id"] = location_id
    
    if price is not None:
        payload["purchase_cost"] = str(price)
    
    response = client.post("/api/v1/hardware", json_data=payload)
    if response and "id" in response:
        return SnipeITAsset(
            id=response["id"],
            asset_tag=asset_tag,
            name=name,
            last_checkout=None,
            last_checkin=None,
            expected_checkin=None
        )
    
    return None


def update_asset(
    client: DryRunSnipeITClient,
    asset_id: int,
    location_id: Optional[int] = None,
    price: Optional[float] = None
) -> Optional[SnipeITAsset]:
    """Update an existing asset in Snipe-IT."""
    payload = {}
    
    if location_id:
        payload["rtd_location_id"] = location_id
    
    if price is not None:
        payload["purchase_cost"] = str(price)
    
    if not payload:
        return None  # Nothing to update
    
    response = client.patch(f"/api/v1/hardware/{asset_id}", json_data=payload)
    if response and "id" in response:
        return SnipeITAsset(
            id=response["id"],
            asset_tag=response.get("asset_tag", ""),
            name=response.get("name"),
            last_checkout=None,
            last_checkin=None,
            expected_checkin=None
        )
    
    return None


def _strip_whitespace_and_junk(name: str) -> str:
    """Common cleanup: strip whitespace, literal escape sequences, and trailing symbols."""
    normalized = name.strip()
    # Remove actual CR/LF characters
    normalized = normalized.replace('\r', '').replace('\n', '')
    # Remove literal \r\n strings (escaped backslash-r-backslash-n from dump)
    normalized = normalized.replace('\\r', '').replace('\\n', '')
    # Remove trailing special characters like -, *, etc.
    normalized = normalized.rstrip('-*').strip()
    return normalized


def _normalize_for_comparison(name: str) -> str:
    """Normalize name for accent-insensitive, case-insensitive comparison.
    
    Snipe-IT uses MySQL which by default has accent-insensitive collation,
    so 'Câmera' and 'Camera' are considered the same name. Python string
    comparison is accent-sensitive, so we must fold accents for matching.
    """
    if not name:
        return ""
    # NFC normalize first for consistent representation
    name = unicodedata.normalize('NFC', name)
    # Decompose to NFKD to separate base chars from combining marks (accents)
    nfkd = unicodedata.normalize('NFKD', name)
    # Strip combining characters (accent marks)
    stripped = ''.join(c for c in nfkd if not unicodedata.combining(c))
    return stripped.lower().strip()


def normalize_category_name(name: str) -> str:
    """Normalize category name by stripping whitespace and handling common variations."""
    if not name:
        return "Uncategorized"
    
    normalized = _strip_whitespace_and_junk(name)
    
    # Handle empty after stripping
    if not normalized:
        return "Uncategorized"
    
    # NFC normalize for consistent Unicode representation
    normalized = unicodedata.normalize('NFC', normalized)
    
    # Capitalize first letter
    normalized = normalized[0].upper() + normalized[1:] if len(normalized) > 1 else normalized.upper()
    
    return normalized


def normalize_manufacturer_name(name: str) -> str:
    """Normalize manufacturer name by stripping whitespace and handling common variations."""
    if not name:
        return "Unknown"
    
    normalized = _strip_whitespace_and_junk(name)
    
    # Handle empty after stripping
    if not normalized:
        return "Unknown"
    
    # NFC normalize for consistent Unicode representation
    normalized = unicodedata.normalize('NFC', normalized)
    
    # Capitalize first letter
    normalized = normalized[0].upper() + normalized[1:] if len(normalized) > 1 else normalized.upper()
    
    # Handle common variations (exact match, case-insensitive)
    variations = {
        # Farnell
        "Farnell": "Farnell",
        # Digi-Key variants
        "Digikey": "Digi-Key",
        "DigiKey": "Digi-Key",
        "Digi Key": "Digi-Key",
        "Digi-Key": "Digi-Key",
        "DIGI-KEY": "Digi-Key",
        # Esite
        "Esite": "Esite",
        "ESITE": "Esite",
        # BeeVeryCreative variants
        "Beeverycreative": "BeeVeryCreative",
        "BeeVeryCreative": "BeeVeryCreative",
        "BeeVery Creative": "BeeVeryCreative",
        # Mouser variants
        "Mouser": "Mouser",
        "Mauser": "Mouser",
        "Robert Mauser": "Mouser",
        # PT Robotics variants
        "PT Robotics": "PT Robotics",
        "PTRobotics": "PT Robotics",
        "Pt Robotics": "PT Robotics",
        # RS Amidata variants
        "RS-Amidata": "RS Amidata",
        "RS Amidata": "RS Amidata",
        # Jovitrónica variants
        "Jovitrónica": "Jovitrónica",
        "Jovitronica": "Jovitrónica",
        "Jovitrónica/RS": "Jovitrónica",
        "Jovitronica/RS": "Jovitrónica",
        # Mixtronica
        "Mixtrónica": "Mixtrónica",
        "Mixtronica": "Mixtrónica",
        # IT Oferta variants
        "IT Oferta": "IT Oferta",
        "Oferta IT": "IT Oferta",
        # DETI
        "DETI": "DETI",
        "Deti": "DETI",
        # DETI/Bosch
        "DETI/Bosch": "DETI/Bosch",
        "Deti/Bosch": "DETI/Bosch",
        # N/A → Unknown
        "N/A": "Unknown",
        "n/a": "Unknown",
        "NA": "Unknown",
        "-": "Unknown",
        # BotNRoll
        "BotNRoll": "BotNRoll",
        "Botnroll": "BotNRoll",
        "BotnRoll": "BotNRoll",
        # Electropositivo/SAR
        "Electropositivo/SAR": "Electropositivo",
    }
    
    # Case-insensitive exact lookup
    lower_normalized = normalized.lower()
    for key, value in variations.items():
        if key.lower() == lower_normalized:
            return value
    
    # Prefix-based mapping for known manufacturer families
    # SAR has many name variants (with/without "de", accent variations, underscores, etc.)
    prefix_mappings = {
        "sar": "SAR",
    }
    for prefix, canonical in prefix_mappings.items():
        if lower_normalized.startswith(prefix):
            return canonical
    
    return normalized


# Simple in-memory caches for categories and manufacturers to avoid repeated API calls
_category_cache: Dict[str, Optional[int]] = {}
_manufacturer_cache: Dict[str, Optional[int]] = {}
_location_cache: Dict[str, Optional[int]] = {}


def cleanup_categories_manufacturers_and_locations(client: DryRunSnipeITClient) -> None:
    """Delete all categories (except default), manufacturers and locations to ensure clean migration."""
    if client.dry_run:
        return
    
    try:
        # Delete all categories except the default one (ID 1)
        response = client.get("/api/v1/categories")
        if "rows" in response:
            for category in response["rows"]:
                if category["id"] != 1:  # Keep the default category
                    try:
                        client.delete(f"/api/v1/categories/{category['id']}")
                    except Exception:
                        pass  # Ignore deletion errors
        
        # Delete all manufacturers
        response = client.get("/api/v1/manufacturers")
        if "rows" in response:
            for manufacturer in response["rows"]:
                try:
                    client.delete(f"/api/v1/manufacturers/{manufacturer['id']}")
                except Exception:
                    pass  # Ignore deletion errors
                    
        # Delete all locations
        response = client.get("/api/v1/locations")
        if "rows" in response:
            for location in response["rows"]:
                try:
                    client.delete(f"/api/v1/locations/{location['id']}")
                except Exception:
                    pass  # Ignore deletion errors
        
        # Clear caches
        _category_cache.clear()
        _manufacturer_cache.clear()
        _location_cache.clear()
    except Exception:
        pass  # Ignore cleanup errors


def _search_entity_by_name(client: DryRunSnipeITClient, endpoint: str, normalized_name: str, limit: int = 50) -> Optional[int]:
    """Search for an entity (category/manufacturer) by name using accent-insensitive comparison.
    
    Returns the entity ID if found, None otherwise.
    """
    try:
        response = client.get(endpoint, params={"search": normalized_name, "limit": limit})
        if "rows" in response:
            comparison_key = _normalize_for_comparison(normalized_name)
            for row in response["rows"]:
                existing_name = row.get("name", "")
                if isinstance(existing_name, str) and _normalize_for_comparison(existing_name) == comparison_key:
                    return row["id"]
    except Exception:
        pass
    return None


def _full_scan_entity_by_name(client: DryRunSnipeITClient, endpoint: str, normalized_name: str) -> Optional[int]:
    """Full paginated scan as a last resort to find an entity by name.
    
    The search endpoint might miss results due to fuzzy matching or pagination.
    This fetches all entities and does an accent-insensitive comparison.
    """
    try:
        comparison_key = _normalize_for_comparison(normalized_name)
        offset = 0
        page_size = 100
        while True:
            response = client.get(endpoint, params={"limit": page_size, "offset": offset})
            rows = response.get("rows", [])
            if not rows:
                break
            for row in rows:
                existing_name = row.get("name", "")
                if isinstance(existing_name, str) and _normalize_for_comparison(existing_name) == comparison_key:
                    return row["id"]
            # Stop if we've fetched all
            total = response.get("total", 0)
            offset += page_size
            if offset >= total:
                break
    except Exception:
        pass
    return None


def find_or_create_category(
    client: DryRunSnipeITClient,
    name: str,
    category_type: str = "asset"
) -> Optional[int]:
    """Find a category by name or create a new one in Snipe-IT. Returns category ID."""
    normalized_name = normalize_category_name(name)
    
    # Check cache first (only successful lookups are cached)
    if normalized_name in _category_cache:
        return _category_cache[normalized_name]
    
    # Also check cache with accent-folded key (handles 'Câmera' vs 'Camera')
    comparison_key = _normalize_for_comparison(normalized_name)
    for cached_name, cached_id in _category_cache.items():
        if cached_id is not None and _normalize_for_comparison(cached_name) == comparison_key:
            _category_cache[normalized_name] = cached_id
            return cached_id
    
    # Try to find existing category via search API
    found_id = _search_entity_by_name(client, "/api/v1/categories", normalized_name)
    if found_id:
        _category_cache[normalized_name] = found_id
        return found_id
    
    # Create new category
    payload = {
        "name": normalized_name,
        "category_type": category_type,
    }
    
    try:
        response = client.post("/api/v1/categories", json_data=payload)
        if response and "payload" in response and "id" in response["payload"]:
            _category_cache[normalized_name] = response["payload"]["id"]
            return response["payload"]["id"]
        elif response and "id" in response:
            _category_cache[normalized_name] = response["id"]
            return response["id"]
        else:
            if client.logger:
                client.logger.error(f"Category creation failed for '{normalized_name}': No ID in response: {response}")
    except Exception as e:
        # If creation failed due to "already exists", do a full scan as last resort
        error_str = str(e).lower()
        if "already been taken" in error_str or "must be unique" in error_str:
            if client.logger:
                client.logger.info(f"Category '{normalized_name}' already exists, doing full scan lookup")
            found_id = _full_scan_entity_by_name(client, "/api/v1/categories", normalized_name)
            if found_id:
                _category_cache[normalized_name] = found_id
                return found_id
        if client.logger:
            client.logger.error(f"Category creation failed for '{normalized_name}': {str(e)}")
    
    # Do NOT cache failures — a transient error shouldn't block all subsequent items
    return None


def find_or_create_manufacturer(
    client: DryRunSnipeITClient,
    name: str
) -> Optional[int]:
    """Find a manufacturer by name or create a new one in Snipe-IT. Returns manufacturer ID."""
    normalized_name = normalize_manufacturer_name(name)
    
    # Check cache first (only successful lookups are cached)
    if normalized_name in _manufacturer_cache:
        return _manufacturer_cache[normalized_name]
    
    # Also check cache with accent-folded key
    comparison_key = _normalize_for_comparison(normalized_name)
    for cached_name, cached_id in _manufacturer_cache.items():
        if cached_id is not None and _normalize_for_comparison(cached_name) == comparison_key:
            _manufacturer_cache[normalized_name] = cached_id
            return cached_id
    
    # Try to find existing manufacturer via search API
    found_id = _search_entity_by_name(client, "/api/v1/manufacturers", normalized_name)
    if found_id:
        _manufacturer_cache[normalized_name] = found_id
        return found_id
    
    # Create new manufacturer
    payload = {
        "name": normalized_name,
    }
    
    try:
        response = client.post("/api/v1/manufacturers", json_data=payload)
        if response and "payload" in response and "id" in response["payload"]:
            _manufacturer_cache[normalized_name] = response["payload"]["id"]
            return response["payload"]["id"]
        elif response and "id" in response:
            _manufacturer_cache[normalized_name] = response["id"]
            return response["id"]
        else:
            if client.logger:
                client.logger.error(f"Manufacturer creation failed for '{normalized_name}': No ID in response: {response}")
    except Exception as e:
        # If creation failed due to "already exists", do a full scan as last resort
        error_str = str(e).lower()
        if "already been taken" in error_str or "must be unique" in error_str:
            if client.logger:
                client.logger.info(f"Manufacturer '{normalized_name}' already exists, doing full scan lookup")
            found_id = _full_scan_entity_by_name(client, "/api/v1/manufacturers", normalized_name)
            if found_id:
                _manufacturer_cache[normalized_name] = found_id
                return found_id
        if client.logger:
            client.logger.error(f"Manufacturer creation failed for '{normalized_name}': {str(e)}")
    
    # Do NOT cache failures — a transient error shouldn't block all subsequent items
    return None


def normalize_location_name(name: str) -> Optional[str]:
    """Normalize location name by stripping whitespace and handling common variations. Returns None if it is missing or N/A."""
    if not name:
        return None
    
    normalized = _strip_whitespace_and_junk(name)
    
    if not normalized:
        return None
    
    # NFC normalize for consistent Unicode representation
    normalized = unicodedata.normalize('NFC', normalized)
    
    # Handle common variations of N/A
    lower_normalized = normalized.lower()
    if lower_normalized in ["n/a", "na", "n.a.", "-", "none", "unknown", "xxxx", "xxxxx"]:
        return None
        
    # Capitalize first letter
    normalized = normalized[0].upper() + normalized[1:] if len(normalized) > 1 else normalized.upper()
    
    return normalized


def find_or_create_location(
    client: DryRunSnipeITClient,
    name: str
) -> Optional[int]:
    """Find a location by name or create a new one in Snipe-IT. Returns location ID."""
    normalized_name = normalize_location_name(name)
    if not normalized_name:
        return None
        
    # Check cache first
    if normalized_name in _location_cache:
        return _location_cache[normalized_name]
    
    # Also check cache with accent-folded key
    comparison_key = _normalize_for_comparison(normalized_name)
    for cached_name, cached_id in _location_cache.items():
        if cached_id is not None and _normalize_for_comparison(cached_name) == comparison_key:
            _location_cache[normalized_name] = cached_id
            return cached_id
            
    # Try to find existing location via search API
    found_id = _search_entity_by_name(client, "/api/v1/locations", normalized_name)
    if found_id:
        _location_cache[normalized_name] = found_id
        return found_id
        
    # Create new location
    payload = {
        "name": normalized_name,
    }
    
    try:
        response = client.post("/api/v1/locations", json_data=payload)
        if response and "payload" in response and "id" in response["payload"]:
            _location_cache[normalized_name] = response["payload"]["id"]
            return response["payload"]["id"]
        elif response and "id" in response:
            _location_cache[normalized_name] = response["id"]
            return response["id"]
        else:
            if client.logger:
                client.logger.error(f"Location creation failed for '{normalized_name}': No ID in response: {response}")
    except Exception as e:
        error_str = str(e).lower()
        if "already been taken" in error_str or "must be unique" in error_str:
            if client.logger:
                client.logger.info(f"Location '{normalized_name}' already exists, doing full scan lookup")
            found_id = _full_scan_entity_by_name(client, "/api/v1/locations", normalized_name)
            if found_id:
                _location_cache[normalized_name] = found_id
                return found_id
        if client.logger:
            client.logger.error(f"Location creation failed for '{normalized_name}': {str(e)}")
            
    return None
