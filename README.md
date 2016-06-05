# A Linode inventory script for ansible

Spits out information about your Linode servers in Ansible's inventory format.

## Usage

It's best to use the provided wrapper script, `hosts`, as a template:

```bash
# list all servers
./hosts --list

# print info on a particular server
./hosts --host <ip address>
```

## Naming conventions

Unfortunately, Linode doesn't support attaching arbitrary tags to instances.
You'll have to do it via an ugly naming convention:

```
<instance name>(_<tag name>_<tag value(s)>(_<tag name>_<tag value(s)>...))
```

Tag values are separated via dashes. Here's an example:

```
www01_groups_www-app_env_prod
```

This server will be named `www01`. It will have a tag `groups` with the values
`["www","app"]` and a tag `env` set to `prod`.

Ugly, right? Oh well.

## ENV vars:

- `LINODE_API_KEY`  
__required__. Your Linode API key.
- `LIMIT_GROUP`:  
If present, the `--list` command only shows servers in the given "Display group"
- `INTERNAL_IPS`:  
If "1", will use your Linode's internal IPs instead of external (public) ips.
This is handy if you want to run ansible internally
- `NON_PREFIXED_TAGS`:  
  A comma-separated list of tags you want to be output directly. Normally tags
  are output in the format `tag_<tagname>_<tagval>` and this will output the
  listed tags in the normal format *and* additionally print them out in the format
  `<tagval>`.  

  For instance, you may have `tag_groups_www` but if you set
  `NON_PREFIXED_TAGS=groups` then you will have `tag_groups_www` *and*
  `www`.

## LICENSE

MIT. Copyright Lyon Bros. Enterprises, LLC.

