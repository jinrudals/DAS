from django import template

register = template.Library()


@register.filter
def get_item(dictionary, key):
    return dictionary.get(key, [])


@register.simple_tag
def lookup(map, target_id, criterion_id):
    return map.get((target_id, criterion_id), None)


@register.filter
def first_owner_username(criterion_targets):
    for ct in criterion_targets:
        owners = ct.owners.all()
        if owners:
            return owners[0].email.split("@")[0]
    return "-"
