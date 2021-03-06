#include <vox/engine.hpp>

#include <cmath>
#ifndef M_PI
#define M_PI 3.1415
#endif // M_PI

#include <vector>
#include <vox/objects/voxelobject.hpp>

typedef unsigned char ubyte;

int main(int argc, char *argv[]) {
	Engine engine;
	
	const ivec3 vs(32,32,32);
	const ivec3 rvs = vs;// + ivec3(2,2,2);
	std::vector<ubyte> data;
	data.resize(4*rvs[0]*rvs[1]*rvs[2]);
	
	const int sx = 8, sy = 8;
	for(int iy = 0; iy < sy; ++iy) {
		for(int ix = 0; ix < sx; ++ix) {
			VoxelObject *vobj = new VoxelObject;
			vobj->id = sx*iy + ix + 2;
			float mx = float(vs.x())/vs.z(), my = float(vs.y())/vs.z();
			vobj->model(0,0) = mx;
			vobj->model(1,1) = my;
			vobj->model(3,0) = mx*(ix - 0.5*(sx - 1));
			vobj->model(3,1) = my*(iy - 0.5*(sy - 1));
			vobj->model(3,2) = -1;
			for(int ivz = 0; ivz < rvs.z(); ++ivz)
			for(int ivy = 0; ivy < rvs.y(); ++ivy)
			for(int ivx = 0; ivx < rvs.x(); ++ivx)
			{
				const float m = 0.1;
				float px = m*((ivx - 1) + ix*vs.x()), py = m*((ivy - 1) + (iy - 1)*vs.y());
				int i = 4*(rvs[0]*(rvs[1]*ivz + ivy) + ivx);
				data[i + 0] = 0x20;
				data[i + 1] = 0xA0;
				data[i + 2] = 0x20;
				data[i + 3] = ((ivz - 1) < (0.5 + 0.5*sin(px + py)*sin(px - py))*vs.z()) ? 0xFF*(1.0 - float(ivz)/rvs.z()) : 0x00;
			}
			vobj->map.init(rvs, data.data(), true);
			vobj->map.genMipMap(4);
			engine.getStorage()->insertObject(vobj);
		}
	}
	
	Camera *cam = new Camera;
	cam->id = 1;
	engine.getStorage()->insertObject(cam);
	engine.getGraphics()->setCamera(1);
	engine.getInput()->setCamera(1);
	
	engine.loop();
	
	for(Object *obj : *engine.getStorage())
		delete obj;
	
	return 0;
}
