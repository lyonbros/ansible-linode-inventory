var Promise = require('bluebird');
var https = require('https');
var querystring = require('querystring');

var config = {
	api_key: process.env['LINODE_API_KEY'],
	limit_group: process.env['LIMIT_GROUP'],
	external_ips: process.env['EXTERNAL_IPS'] == '1',
	non_prefixed_tags: process.env['NON_PREFIXED_TAGS'].split(',')
};

function usage()
{
	console.log();
	console.log('Usage: ');
	console.log('  node hosts.js <command>');
	console.log();
	console.log('Commands: ');
	console.log('  --list  ::  list all available hosts (default action)');
	console.log('  --host  ::  output info on a specific host');
	console.log();
	process.exit(1);
};

if(!config.api_key)
{
	console.error('no api key given');
	usage();
}

var command = process.argv[2];
var cli_arg = process.argv[3];

if(!command) command = '--list';
switch(command)
{
	case '--list':
		break;
	case '--host':
		break;
	default:
		usage();
		break;
}

function linode_api_call(action, args)
{
	return new Promise(function(resolve, reject) {
		args = JSON.parse(JSON.stringify(args || {}));
		args.api_key = config.api_key;
		args.api_action = action;
		var qs = querystring.stringify(args);
		var path = '/?'+qs;
		var opts = {
			method: 'GET',
			hostname: 'api.linode.com',
			port: 443,
			path: path
		};
		var req = https.request(opts, function(res) {
			res.setEncoding('utf8');
			var body = [];
			res.on('data', function(chunk) {
				body.push(chunk);
			});
			res.on('end', function() {
				resolve({
					status: res.statusCode,
					headers: res.headers,
					body: body.join('')
				});
			});
		});
		req.on('error', function(err) {
			reject(err);
		});
		req.end();
	});
}

function linode(action, args)
{
	return linode_api_call(action, args)
		.then(function(res) {
			var parsed = JSON.parse(res.body);
			var data = parsed.DATA;
			return data;
		});
}

function parse_label(label)
{
	var parts = label.split(/_/g);
	var name = parts[0];
	parts.shift();
	var tags = {};
	var tagname = null;
	for(var i = 0; i < parts.length; i++)
	{
		if(!tagname)
		{
			tagname = parts[i];
			continue;
		}
		tags[tagname] = parts[i].split(/-/g);
		tagname = null;
	}
	tags.name = name;
	return tags;
}

function run()
{
	var promises = [
		linode('linode.list'),
		linode('linode.ip.list')
	];
	var servers = {};
	return Promise.all(promises)
		.spread(function(linodes, ips) {
			linodes.forEach(function(linode) {
				if(config.limit_group && linode.LPM_DISPLAYGROUP != config.limit_group) return;
				var label = linode.LABEL;
				var parts = label.split(/_/g);
				servers[linode.LINODEID] = linode;
			});
			ips.forEach(function(ip) {
				var linode = servers[ip.LINODEID];
				if(!linode) return;
				if(ip.ISPUBLIC === 1)
				{
					linode['IPPUBLIC'] = ip.IPADDRESS;
				}
				else
				{
					linode['IPPRIVATE'] = ip.IPADDRESS;
				}
			});

			var output = {
				_meta: {
					hostvars: {}
				}
			};
			var ips = {};
			Object.keys(servers).forEach(function(id) {
				var linode = servers[id];
				var tags = parse_label(linode.LABEL);
				var ip = config.external_ips ? linode.IPPUBLIC : linode.IPPRIVATE;

				var entry = {
					id: id,
					group: linode.LPM_DISPLAYGROUP,
					datacenter: linode.DATACENTERID,
					ram: linode.TOTALRAM,
					status: ({
						'-1': 'created',
						'0': 'new',
						'1': 'running',
						'2': 'stopped'
					})[linode.STATUS],
					ip_internal: ip,
					ip_external: linode.IPPUBLIC,
					name: tags.name
				};
				ips[ip] = entry;

				var key_push = function(key)
				{
					if(!output[key]) output[key] = [];
					output[key].push(ip);
				};

				output._meta.hostvars[entry.ip_internal] = entry;
				key_push('id_'+entry.id);
				key_push('datacenter_'+entry.datacenter);
				key_push('group_'+entry.group);
				Object.keys(tags).forEach(function(name) {
					var val = tags[name];
					entry[name] = val;
					if(!Array.isArray(val)) val = [val];
					val.forEach(function(val) {
						key_push('tag_'+name+'_'+val);
						if(config.non_prefixed_tags.indexOf(name) >= 0) key_push(val);
					});
				});
			});
			var sorted = {};
			Object.keys(output).sort().forEach(function(key) {
				sorted[key] = output[key];
			});

			if(command == '--host')
			{
				console.log(JSON.stringify(ips[cli_arg], null, 2));
			}
			else
			{
				console.log(JSON.stringify(sorted, null, 2));
			}
		})
		.catch(function(err) {
			console.error(err, err.stack);
		})
		.finally(setTimeout.bind(this, process.exit, 100));
}

run();

