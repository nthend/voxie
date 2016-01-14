#version 130

uniform sampler3D u_texture;
// uniform sampler3D u_light_texture;
uniform ivec3 u_size;
uniform ivec3 u_offset;
uniform ivec3 u_real_size;

uniform mat4 u_tex;
uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_proj;

uniform mat4 u_inv_tex;
uniform mat4 u_inv_model;
uniform mat4 u_inv_view;

uniform ivec2 u_lod;

uniform vec4 u_ambient;
uniform vec4 u_light_pos;
uniform vec4 u_light_color;

in vec4 v_tex_pos;
in vec4 v_tex_norm;
in vec4 v_tex_dir;
in float v_z_value;

out vec4 out_FragColor;

const float GRID_DELTA = 1e-2;

ivec3 get_size_lod(ivec3 size, int lod) {
	return (size - ivec3(1))/(1<<lod) + ivec3(1);
}

vec3 tex_to_grid(vec3 tc, int lod) {
	return tc*vec3(get_size_lod(u_size, lod));
}

vec3 grid_to_tex(vec3 gc, int lod) {
	return gc/vec3(get_size_lod(u_size, lod));
}

const float BORDER_DELTA = 1e-3;

bool is_outside_float(vec3 p, vec3 size) {
	vec3 eps = BORDER_DELTA*size;
	bvec3 lb = greaterThan(-eps, p);
	bvec3 hb = greaterThanEqual(p, size + eps);
	return lb.x || lb.y || lb.z || hb.x || hb.y || hb.z;
}

bool is_outside_int(ivec3 p, ivec3 size) {
	bvec3 lb = greaterThan(ivec3(0), p);
	bvec3 hb = greaterThanEqual(p, size);
	return lb.x || lb.y || lb.z || hb.x || hb.y || hb.z;
}

float get_depth(float z) {
	return 0.5 - 0.5*(u_proj[2][2] + u_proj[3][2]/z);
}

vec4 sample_int(ivec3 p, int lod) {
	return texelFetch(u_texture, p, lod);
}
vec4 sample_float(vec3 p, int lod) {
	 return textureLod(u_texture, grid_to_tex(p, lod), lod);
}

bool is_solid(ivec3 p, int lod) {
	return sample_int(p, lod).a > 0.1;
}

float get_occlusion(vec3 p, ivec3 n, int lod) {
	ivec3 bx = ivec3(n.x == 0, n.x != 0, 0);
	ivec3 by = ivec3(0, n.z != 0, (n.x != 0) || (n.y != 0));
	ivec3 bp = ivec3(floor(p)) + n;
	vec3 c = fract(p) - vec3(0.5);
	float x = dot(c, vec3(bx));
	float y = dot(c, vec3(by));
	float s = 1.0;
	if(!is_solid(bp, lod)) {
		s += (0.5 + x)*float(!is_solid(bp + bx, lod));
		s += (0.5 + y)*float(!is_solid(bp + by, lod));
		s += (0.5 - x)*float(!is_solid(bp - bx, lod));
		s += (0.5 - y)*float(!is_solid(bp - by, lod));
		s += (0.5 + x)*(0.5 + y)*float(!is_solid(bp + bx + by, lod));
		s += (0.5 - x)*(0.5 + y)*float(!is_solid(bp - bx + by, lod));
		s += (0.5 - x)*(0.5 - y)*float(!is_solid(bp - bx - by, lod));
		s += (0.5 + x)*(0.5 - y)*float(!is_solid(bp + bx - by, lod));
	}
	return s/4.0;
}

bool trace(vec3 pos, vec3 dir, out float t, out ivec3 dip, out vec3 sp, int lod) {
	ivec3 size = get_size_lod(u_size, lod);
	vec3 d = tex_to_grid(dir, lod);
	vec3 p = tex_to_grid(pos - 0.5*BORDER_DELTA*normalize(dir), lod);
	ivec3 id = ivec3(sign(d));
	ivec3 ip = ivec3(ceil(p))*ivec3(greaterThan(id,ivec3(0,0,0))) + ivec3(floor(p))*ivec3(greaterThan(ivec3(0,0,0),id));
	
	sp = p;
	vec3 cp = p;
	ivec3 cip;
	
	vec3 dp;
	t = 0.0;
	
	int i;
	for(i = 0; i < size[0] + size[1] + size[2] + 3; ++i) {
		vec3 ts;
		
		// choose next intersection plane
		ts = (vec3(ip) - p)/d;
		if(ts.x < ts.y) {
			if(ts.x < ts.z) {
				dip = ivec3(id.x,0,0);
				t = ts.x;
			} else {
				dip = ivec3(0,0,id.z);
				t = ts.z;
			}
		} else {
			if(ts.y < ts.z) {
				dip = ivec3(0,id.y,0);
				t = ts.y;
			} else {
				dip = ivec3(0,0,id.z);
				t = ts.z;
			}
		}
		
		// compute intersection parameters
		dp = vec3(dip);
		sp = p + d*t;
		cp = sp + 0.5*dp;
		cip = ivec3(floor(cp));
		
		// increment intersection iterator
		ip += dip;
		
		// not found if point is outside
		if(is_outside_float(sp, vec3(size))) {
			return false;
		}
		
		// found if opaque enough
		if(is_solid(cip, lod) && !is_outside_int(cip, size)) {
			return true;
		}
	}
}

void main() {
	vec4 color = vec4(0.0);
	float shadow = 1.0;
	float depth = 1.0;
	vec3 norm = v_tex_norm.xyz;
	vec3 pos = v_tex_pos.xyz;
	vec3 dir = v_tex_dir.xyz;
	
	depth = gl_FragCoord.z;
	//depth = get_depth(v_z_value);
	
	vec3 sp, cp;
	ivec3 dip = ivec3(0);
	float t = 0.0;
	bool found = trace(pos, dir, t, dip, sp, u_lod[0]);
	cp = sp + 0.5*vec3(dip);
	
	if(found) {
		color = vec4(sample_float(cp, u_lod[0]).rgb, 1.0);
		shadow = get_occlusion(cp, -dip, u_lod[0]);
		
		// depth and normal
		depth = get_depth(v_z_value*(1.0 + t));
		vec3 n = -vec3(dip);
		
		// light
		vec3 w_pos = (u_model*u_inv_tex*vec4(grid_to_tex(sp, u_lod[0]), 1.0)).xyz;
		vec3 w_norm = normalize((u_model*u_inv_tex*vec4(n, 0.0)).xyz);
		vec4 light_pos = u_light_pos;
		vec3 light_dir = normalize(light_pos.xyz - w_pos*light_pos.w);
		vec3 dif = max(dot(w_norm, light_dir), 0.0)*u_light_color.rgb;
		vec3 amb = u_ambient.rgb;
		vec3 new_color = amb*color.rgb*shadow + dif*color.rgb*shadow; 
		color.rgb = new_color.rgb;
		
		// specular
		vec3 v_pos = (u_inv_view*vec4(0,0,0,1)).xyz;
		vec3 v_dir = normalize(w_pos - v_pos);
		vec3 r_dir = v_dir - 2.0*dot(v_dir, w_norm)*w_norm;
		color.rgb += vec3(pow(max(dot(r_dir, light_dir), 0.0), 64.0))*shadow;
	} else {
		depth = 1.0;
	}
	
	gl_FragDepth = depth;
	out_FragColor = vec4(color);
}
