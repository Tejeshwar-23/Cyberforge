import json
from typing import Any

import yaml
from defusedxml import ElementTree as SafeET


class ResponseParseError(Exception):
    """Raised when an API response cannot be parsed safely."""


def _xml_element_to_value(element) -> Any:
    children = list(element)

    if not children:
        text = element.text.strip() if element.text else ""
        return text

    result: dict[str, Any] = {}

    for child in children:
        value = _xml_element_to_value(child)

        if child.tag in result:
            if not isinstance(result[child.tag], list):
                result[child.tag] = [result[child.tag]]
            result[child.tag].append(value)
        else:
            result[child.tag] = value

    if element.attrib:
        result["@attributes"] = dict(element.attrib)

    return result


def parse_json_response(content: str) -> Any:
    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        raise ResponseParseError(
            f"Invalid JSON response: {exc}"
        ) from exc


def parse_yaml_response(content: str) -> Any:
    try:
        data = yaml.safe_load(content)
    except yaml.YAMLError as exc:
        raise ResponseParseError(
            f"Invalid YAML response: {exc}"
        ) from exc

    if data is None:
        raise ResponseParseError("YAML response is empty")

    return data


def parse_xml_response(content: str) -> Any:
    try:
        root = SafeET.fromstring(content)
    except Exception as exc:
        raise ResponseParseError(
            f"Invalid or unsafe XML response: {exc}"
        ) from exc

    return {
        root.tag: _xml_element_to_value(root)
    }


def parse_response(
    content: str,
    response_format: str,
) -> Any:
    format_name = response_format.lower().strip()

    if format_name == "json":
        return parse_json_response(content)

    if format_name == "xml":
        return parse_xml_response(content)

    if format_name == "yaml":
        return parse_yaml_response(content)

    raise ResponseParseError(
        f"Unsupported response format: {response_format}"
    )
